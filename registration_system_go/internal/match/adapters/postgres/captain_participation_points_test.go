package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	teampostgres "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/postgres"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestCaptainOrganizationBonusFixedPerMatch(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	captain, team := seedMatchOwner(t, pool)
	member, extra := seedMatchUser(t, pool), seedMatchUser(t, pool)
	if _, err := pool.Exec(ctx, `INSERT INTO team_members(team_id,user_id,role) VALUES ($1,$2,'captain'),($1,$3,'member'),($1,$4,'member')`, team, captain, member, extra); err != nil {
		t.Fatal(err)
	}
	m, groups := newPersistableMatch(t, captain, team)
	m.Status = domain.MatchEnded
	m.StartTime = time.Now().UTC().Add(-48 * time.Hour)
	m.EndTime = m.StartTime.Add(time.Hour)
	repo := NewRepository(pool)
	if err := repo.CreateWithGroups(ctx, m, groups); err != nil {
		t.Fatal(err)
	}
	for _, user := range []int64{captain, member, extra} {
		r, err := domain.NewRegistration(groups[0].ID, user, domain.RegistrationAttending, 1, m.CreatedAt)
		if err != nil {
			t.Fatal(err)
		}
		if err := repo.CreateRegistration(ctx, r); err != nil {
			t.Fatal(err)
		}
		if user != extra {
			if _, err := pool.Exec(ctx, `UPDATE match_registrations SET participation_confirmed_at=$2,early_registration_bonus=30 WHERE id=$1`, r.ID, r.CreatedAt); err != nil {
				t.Fatal(err)
			}
		}
	}
	teamRepo := teampostgres.NewRepository(pool)
	assertPoints := func(user, expected int64) {
		t.Helper()
		var points int64
		if err := pool.QueryRow(ctx, `SELECT points FROM team_participation_points WHERE group_id=$1 AND user_id=$2`, groups[0].ID, user).Scan(&points); err != nil {
			t.Fatal(err)
		}
		if points != expected {
			t.Fatalf("user=%d points=%d want=%d", user, points, expected)
		}
		records, err := teamRepo.ListMemberAttendanceRecords(ctx, team, user, nil, nil)
		if err != nil || len(records) != 1 || records[0].ParticipationPoints != expected {
			t.Fatalf("records=%+v err=%v", records, err)
		}
		annual, err := teamRepo.ListAnnualParticipationPoints(ctx, team, user)
		if err != nil || len(annual) != 1 || annual[0].ParticipationPoints != expected {
			t.Fatalf("annual=%+v err=%v", annual, err)
		}
	}
	assertPoints(captain, 100) // 6 attendance + 3 response + exactly 1 organization.
	assertPoints(member, 90)
	assertPoints(extra, 60)
	if _, err := pool.Exec(ctx, `UPDATE match_registrations SET status='leave' WHERE group_id=$1 AND user_id=$2`, groups[0].ID, captain); err != nil {
		t.Fatal(err)
	}
	assertPoints(captain, 40) // Organization is independent of the captain's attendance.
	var attended int64
	if err := pool.QueryRow(ctx, `SELECT attended_count FROM team_participation_totals WHERE team_id=$1 AND user_id=$2`, team, captain).Scan(&attended); err != nil || attended != 0 {
		t.Fatalf("organization counted as attendance: %d err=%v", attended, err)
	}
	_, members, found, err := teamRepo.ListMatchAttendance(ctx, team, m.ID)
	if err != nil || !found || len(members) != 3 {
		t.Fatalf("members=%+v err=%v", members, err)
	}
	for _, item := range members {
		if item.UserID == captain && item.ParticipationPoints != 40 {
			t.Fatalf("captain match total=%+v", item)
		}
	}
	if _, err := pool.Exec(ctx, `UPDATE match_registration_groups SET status='cancelled',cancelled_at=(NOW() AT TIME ZONE 'UTC') WHERE id=$1`, groups[0].ID); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM team_participation_points WHERE group_id=$1`, groups[0].ID).Scan(&count); err != nil || count != 0 {
		t.Fatalf("cancelled group awarded points: %d err=%v", count, err)
	}
}

func TestCaptainOrganizationBonusSurvivesCaptainTransfer(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	original, team := seedMatchOwner(t, pool)
	next := seedMatchUser(t, pool)
	if _, err := pool.Exec(ctx, `INSERT INTO team_members(team_id,user_id,role) VALUES ($1,$2,'captain'),($1,$3,'member')`, team, original, next); err != nil {
		t.Fatal(err)
	}
	repo := NewRepository(pool)
	teamRepo := teampostgres.NewRepository(pool)
	for index, expected := range []int64{original, next} {
		m, groups := newPersistableMatch(t, original, team)
		m.Status = domain.MatchEnded
		if err := repo.CreateWithGroups(ctx, m, groups); err != nil {
			t.Fatal(err)
		}
		if index == 0 {
			if err := teamRepo.SetCaptain(ctx, team, &next); err != nil {
				t.Fatal(err)
			}
		}
		// No registration is needed to receive the fixed organizing reward.
		var user, points, attendance int64
		if err := pool.QueryRow(ctx, `SELECT user_id,points,attendance_points FROM team_participation_points WHERE group_id=$1`, groups[0].ID).Scan(&user, &points, &attendance); err != nil {
			t.Fatal(err)
		}
		if user != expected || points != 10 || attendance != 0 {
			t.Fatalf("index=%d organizer=%d points=%d attendance=%d", index, user, points, attendance)
		}
		if index == 1 {
			if err := teamRepo.SetCaptain(ctx, team, &original); err != nil {
				t.Fatal(err)
			}
			if err := pool.QueryRow(ctx, `SELECT user_id FROM team_participation_points WHERE group_id=$1`, groups[0].ID).Scan(&user); err != nil || user != next {
				t.Fatalf("organization reward moved after transfer: %d err=%v", user, err)
			}
		}
	}
}
