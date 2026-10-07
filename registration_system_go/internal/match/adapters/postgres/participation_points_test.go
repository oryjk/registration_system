package postgres

import (
	"context"
	matchapplication "github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	teampostgres "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/postgres"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
	"testing"
	"time"
)

func TestAnnualParticipationPointsHistoryAndCorrections(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	owner, team := seedMatchOwner(t, pool)
	repo := NewRepository(pool)
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id,user_id,role,status) VALUES ($1,$2,'captain','active')`, team, owner); err != nil {
		t.Fatal(err)
	}
	for i, start := range []time.Time{time.Date(2024, 12, 31, 15, 59, 0, 0, time.UTC), time.Date(2024, 12, 31, 16, 0, 0, 0, time.UTC)} {
		m, groups := newPersistableMatch(t, owner, team)
		m.Status = domain.MatchEnded
		m.StartTime = start
		m.EndTime = start.Add(time.Hour)
		if err := repo.CreateWithGroups(ctx, m, groups); err != nil {
			t.Fatal(err)
		}
		r, err := domain.NewRegistration(groups[0].ID, owner, domain.RegistrationAttending, 1, start.Add(-time.Hour))
		if err != nil {
			t.Fatal(err)
		}
		if err = repo.CreateRegistration(ctx, r); err != nil {
			t.Fatal(err)
		}
		// No trusted user confirmation in historical/admin-created records.
		var year int
		var points int64
		if err = pool.QueryRow(ctx, `SELECT score_year, points FROM team_participation_points WHERE registration_id=$1`, r.ID).Scan(&year, &points); err != nil {
			t.Fatal(err)
		}
		if year != 2024+i || points != 70 {
			t.Fatalf("year=%d points=%d", year, points)
		}
		if i == 1 {
			if _, err = pool.Exec(ctx, `UPDATE match_registrations SET participation_confirmed_at=$2,early_registration_bonus=30 WHERE id=$1`, r.ID, start.Add(-time.Hour)); err != nil {
				t.Fatal(err)
			}
			if _, err = pool.Exec(ctx, `UPDATE match_registrations SET status='absent' WHERE id=$1`, r.ID); err != nil {
				t.Fatal(err)
			}
			var count int
			if err = pool.QueryRow(ctx, `SELECT count(*) FROM team_participation_points WHERE registration_id=$1`, r.ID).Scan(&count); err != nil || count != 1 {
				t.Fatalf("absent lost fixed response reward %d err=%v", count, err)
			}
			if _, err = pool.Exec(ctx, `UPDATE match_registrations SET status='attending' WHERE id=$1`, r.ID); err != nil {
				t.Fatal(err)
			}
		}
	}
	rows, err := pool.Query(ctx, `SELECT score_year, participation_points FROM team_participation_totals WHERE team_id=$1 AND user_id=$2 ORDER BY score_year`, team, owner)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	total := int64(0)
	years := 0
	for rows.Next() {
		var year int
		var points int64
		if err = rows.Scan(&year, &points); err != nil {
			t.Fatal(err)
		}
		total += points
		years++
	}
	if rows.Err() != nil || years != 2 || total != 170 {
		t.Fatalf("history years=%d total=%d err=%v", years, total, rows.Err())
	}
	teamRepo := teampostgres.NewRepository(pool)
	annual, err := teamRepo.ListAnnualParticipationPoints(ctx, team, owner)
	if err != nil || len(annual) != 2 || annual[0].ScoreYear != 2025 || annual[0].ParticipationPoints != 100 || annual[1].ParticipationPoints != 70 {
		t.Fatalf("annual API rows=%+v err=%v", annual, err)
	}
	members, err := teamRepo.ListAppMembers(ctx, team)
	if err != nil || len(members) != 1 || members[0].ParticipationPoints != 0 || members[0].ParticipationRank != nil {
		t.Fatalf("current year did not reset %+v err=%v", members, err)
	}
	records, err := teamRepo.ListMemberAttendanceRecords(ctx, team, owner, nil, nil)
	if err != nil || len(records) != 2 || records[0].ParticipationPoints != 100 || records[1].ParticipationPoints != 70 {
		t.Fatalf("record totals=%+v err=%v", records, err)
	}
	if _, err = pool.Exec(ctx, `UPDATE team_members SET status='left' WHERE team_id=$1 AND user_id=$2`, team, owner); err != nil {
		t.Fatal(err)
	}
	annual, err = teamRepo.ListAnnualParticipationPoints(ctx, team, owner)
	if err != nil || len(annual) != 2 {
		t.Fatalf("left member lost history %+v err=%v", annual, err)
	}

}

func TestSelfParticipationRewardPersistedWithAvailabilityAndAdminCorrection(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	owner, team := seedMatchOwner(t, pool)
	repo := NewRepository(pool)
	now := time.Now().UTC().Truncate(time.Microsecond)
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id,user_id,role,status) VALUES ($1,$2,'captain','active')`, team, owner); err != nil {
		t.Fatal(err)
	}
	m, groups := newPersistableMatch(t, owner, team)
	m.Status = domain.MatchRegistering
	m.StartTime = now.Add(24 * time.Hour)
	m.EndTime = m.StartTime.Add(time.Hour)
	if err := repo.CreateWithGroups(ctx, m, groups); err != nil {
		t.Fatal(err)
	}
	// Publication precedes opening; member joins later; baseline must be latest.
	for _, q := range []struct {
		sql  string
		args []any
	}{
		{`UPDATE matches SET created_at=$2, registration_start_at=$3 WHERE id=$1`, []any{m.ID, now.Add(-12 * time.Hour), now.Add(-6 * time.Hour)}},
		{`UPDATE match_registration_groups SET created_at=$2 WHERE id=$1`, []any{groups[0].ID, now.Add(-5 * time.Hour)}},
		{`UPDATE team_members SET joined_at=$3 WHERE team_id=$1 AND user_id=$2`, []any{team, owner, now.Add(-30 * time.Minute)}},
	} {
		if _, err := pool.Exec(ctx, q.sql, q.args...); err != nil {
			t.Fatal(err)
		}
	}
	user := matchapplication.NewUserRegistrationService(repo, repositoryTestClock{now: now})
	r, err := user.Put(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: owner}, m.ID, groups[0].ID, matchapplication.PutMyRegistrationCommand{Status: domain.RegistrationAttending, RegistrationCount: 1})
	if err != nil || r.EarlyRegistrationBonus != 30 {
		t.Fatalf("self confirm %+v err=%v", r, err)
	}
	// First response survives leave, cancellation and later attendance in storage.
	for _, status := range []domain.RegistrationStatus{domain.RegistrationLeave, domain.RegistrationAttending} {
		service := matchapplication.NewUserRegistrationService(repo, repositoryTestClock{now: now.Add(8 * time.Hour)})
		updated, err := service.Put(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: owner}, m.ID, groups[0].ID, matchapplication.PutMyRegistrationCommand{Status: status, RegistrationCount: 1})
		if err != nil || updated.EarlyRegistrationBonus != 30 || !updated.ParticipationConfirmedAt.Equal(now) {
			t.Fatalf("status changed first response %+v err=%v", updated, err)
		}
	}
	service := matchapplication.NewUserRegistrationService(repo, repositoryTestClock{now: now.Add(9 * time.Hour)})
	cancelled, err := service.Delete(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: owner}, m.ID, groups[0].ID)
	if err != nil || cancelled.EarlyRegistrationBonus != 30 || !cancelled.ParticipationConfirmedAt.Equal(now) {
		t.Fatalf("cancellation lost first response %+v err=%v", cancelled, err)
	}
	restored, err := service.Put(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: owner}, m.ID, groups[0].ID, matchapplication.PutMyRegistrationCommand{Status: domain.RegistrationAttending, RegistrationCount: 1})
	if err != nil || restored.EarlyRegistrationBonus != 30 || !restored.ParticipationConfirmedAt.Equal(now) {
		t.Fatalf("re-entry changed first response %+v err=%v", restored, err)
	}
	// End the match and edit its opening time. Persisted bonus remains unchanged.
	if _, err = pool.Exec(ctx, `UPDATE matches SET status='ended',start_time=$2,end_time=$3,registration_start_at=$4 WHERE id=$1`, m.ID, now.Add(-2*time.Hour), now.Add(-time.Hour), now.Add(-72*time.Hour)); err != nil {
		t.Fatal(err)
	}
	admin := matchapplication.NewAdminRegistrationService(repo, repositoryTestClock{now: now.Add(time.Hour)})
	for _, status := range []domain.RegistrationStatus{domain.RegistrationAbsent, domain.RegistrationAttending} {
		updated, err := admin.Put(ctx, sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, m.ID, groups[0].ID, owner, status)
		if err != nil || updated.EarlyRegistrationBonus != 30 || updated.ParticipationConfirmedAt == nil || !updated.ParticipationConfirmedAt.Equal(now) {
			t.Fatalf("admin metadata %+v err=%v", updated, err)
		}
	}
	var points int64
	if err = pool.QueryRow(ctx, `SELECT points FROM team_participation_points WHERE registration_id=$1`, r.ID).Scan(&points); err != nil || points != 100 {
		t.Fatalf("points=%d err=%v", points, err)
	}
	for _, q := range []string{`UPDATE match_registration_groups SET status='cancelled',cancelled_at=(NOW() AT TIME ZONE 'UTC') WHERE id=$1`} {
		if _, err = pool.Exec(ctx, q, groups[0].ID); err != nil {
			t.Fatal(err)
		}
	}
	var n int
	if err = pool.QueryRow(ctx, `SELECT count(*) FROM team_participation_points WHERE registration_id=$1`, r.ID).Scan(&n); err != nil || n != 0 {
		t.Fatalf("cancelled group counted %d err=%v", n, err)
	}
}

func TestFirstResponseScoresLeaveWithoutAttendanceBase(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	owner, team := seedMatchOwner(t, pool)
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id,user_id,role,status) VALUES ($1,$2,'captain','active')`, team, owner); err != nil {
		t.Fatal(err)
	}
	repo := NewRepository(pool)
	teamRepo := teampostgres.NewRepository(pool)
	m, groups := newPersistableMatch(t, owner, team)
	m.Status = domain.MatchEnded
	if err := repo.CreateWithGroups(ctx, m, groups); err != nil {
		t.Fatal(err)
	}
	r, _ := domain.NewRegistration(groups[0].ID, owner, domain.RegistrationAttending, 1, m.CreatedAt.Add(time.Minute))
	if err := repo.CreateRegistration(ctx, r); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE match_registrations SET participation_confirmed_at=$2,early_registration_bonus=30 WHERE id=$1`, r.ID, r.CreatedAt); err != nil {
		t.Fatal(err)
	}
	for _, status := range []string{"attending", "leave", "absent", "cancelled"} {
		if _, err := pool.Exec(ctx, `UPDATE match_registrations SET status=$2::varchar,cancelled_at=CASE WHEN $2::varchar='cancelled' THEN updated_at ELSE NULL END WHERE id=$1`, r.ID, status); err != nil {
			t.Fatal(err)
		}
		var points int64
		if err := pool.QueryRow(ctx, `SELECT points FROM team_participation_points WHERE registration_id=$1`, r.ID).Scan(&points); err != nil {
			t.Fatalf("response bonus disappeared on %s: %v", status, err)
		}
		expected := int64(30)
		if status == "attending" {
			expected = 100
		}
		if points != expected {
			t.Fatalf("status=%s points=%d expected=%d", status, points, expected)
		}
		var attended int64
		if err := pool.QueryRow(ctx, `SELECT attended_count FROM team_participation_totals WHERE team_id=$1 AND user_id=$2`, team, owner).Scan(&attended); err != nil {
			t.Fatal(err)
		}
		expectedCount := int64(0)
		if status == "attending" {
			expectedCount = 1
		}
		if attended != expectedCount {
			t.Fatalf("leave treated as attendance: %d", attended)
		}
		ranking, err := teamRepo.ListAttendanceRanking(ctx, team, nil, nil)
		if err != nil || len(ranking) != 1 || ranking[0].ParticipationPoints != expected || ranking[0].AttendedCount != expectedCount {
			t.Fatalf("status=%s ranking=%+v err=%v", status, ranking, err)
		}
		records, err := teamRepo.ListMemberAttendanceRecords(ctx, team, owner, nil, nil)
		if err != nil || len(records) != 1 || records[0].ParticipationPoints != expected {
			t.Fatalf("status=%s records=%+v err=%v", status, records, err)
		}
		_, members, found, err := teamRepo.ListMatchAttendance(ctx, team, m.ID)
		if err != nil || !found || len(members) != 1 || members[0].ParticipationPoints != expected {
			t.Fatalf("status=%s match members=%+v err=%v", status, members, err)
		}
	}
}
