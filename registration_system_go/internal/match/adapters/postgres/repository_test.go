package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestRepositoryCreatesAndFindsMatchWithGroups(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	match, groups := newPersistableMatch(t, userID, teamID)
	repository := NewRepository(pool)

	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}
	found, foundGroups, ok, err := repository.FindByID(ctx, match.ID)
	if err != nil {
		t.Fatalf("find match: %v", err)
	}
	if !ok || found.ID != match.ID || len(foundGroups) != len(groups) {
		t.Fatalf("unexpected persisted aggregate: match=%+v groups=%+v ok=%v", found, foundGroups, ok)
	}
}

func TestRepositoryRollsBackMatchWhenGroupInsertFails(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	match, groups := newPersistableMatch(t, userID, teamID)
	duplicate := groups[0]
	duplicate.ID = uuid.New()
	groups = append(groups, duplicate)
	repository := NewRepository(pool)

	if err := repository.CreateWithGroups(ctx, match, groups); err == nil {
		t.Fatal("expected duplicate group insert to fail")
	}
	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM matches WHERE id = $1`, match.ID).Scan(&count); err != nil {
		t.Fatalf("count matches: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected transaction rollback, found %d match rows", count)
	}
}

func TestRepositoryDeletesMatchAndCascadesBusinessData(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	match, groups := newPersistableMatch(t, userID, teamID)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_registrations (id, group_id, user_id)
		VALUES ($1, $2, $3)`, uuid.New(), groups[0].ID, userID); err != nil {
		t.Fatalf("seed registration: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_team_applications (id, match_id, applicant_team_id, introduction, created_by_user_id)
		VALUES ($1, $2, $3, '申请参赛', $4)`, uuid.New(), match.ID, teamID, userID); err != nil {
		t.Fatalf("seed team application: %v", err)
	}

	deleted, err := repository.Delete(ctx, match.ID)
	if err != nil {
		t.Fatalf("delete match: %v", err)
	}
	if !deleted {
		t.Fatal("expected match to be deleted")
	}

	checks := []struct {
		table string
		query string
		id    uuid.UUID
	}{
		{table: "matches", query: `SELECT COUNT(*) FROM matches WHERE id = $1`, id: match.ID},
		{table: "match_registration_groups", query: `SELECT COUNT(*) FROM match_registration_groups WHERE match_id = $1`, id: match.ID},
		{table: "match_registrations", query: `SELECT COUNT(*) FROM match_registrations WHERE group_id = $1`, id: groups[0].ID},
		{table: "match_team_applications", query: `SELECT COUNT(*) FROM match_team_applications WHERE match_id = $1`, id: match.ID},
	}
	for _, check := range checks {
		var count int
		if err := pool.QueryRow(ctx, check.query, check.id).Scan(&count); err != nil {
			t.Fatalf("count %s: %v", check.table, err)
		}
		if count != 0 {
			t.Fatalf("expected %s to be deleted, found %d rows", check.table, count)
		}
	}
}

func seedMatchOwner(t *testing.T, pool interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}) (int64, int64) {
	t.Helper()
	ctx := context.Background()
	var userID, teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ($1) RETURNING id`, "owner-"+uuid.NewString()).Scan(&userID); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name, captain_id) VALUES ('东安联队', $1) RETURNING id`, userID).Scan(&teamID); err != nil {
		t.Fatalf("seed team: %v", err)
	}
	return userID, teamID
}

func newPersistableMatch(t *testing.T, userID, teamID int64) (domain.Match, []domain.RegistrationGroup) {
	t.Helper()
	start := time.Date(2026, 7, 20, 18, 0, 0, 0, time.UTC)
	match, groups, err := domain.NewMatch(domain.NewMatchInput{
		Name:            "周末约球",
		PublicationMode: domain.OnlineTeam,
		HostTeamID:      teamID,
		CreatedByUserID: int64Pointer(userID),
		PlayersPerTeam:  8,
		StartTime:       start,
		EndTime:         start.Add(2 * time.Hour),
		Location:        "东安球场",
		CreatedAt:       start.Add(-24 * time.Hour),
	}, domain.IndividualLimits{})
	if err != nil {
		t.Fatalf("new match: %v", err)
	}
	return match, groups
}

func int64Pointer(value int64) *int64 { return &value }

func TestRepositoryListsTeamGroupRoster(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	match, groups := newPersistableMatch(t, userID, teamID)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}

	var memberID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid, nickname, real_name) VALUES ($1, $2, $3) RETURNING id`,
		"member-"+uuid.NewString(), "阿东", "李东").Scan(&memberID); err != nil {
		t.Fatalf("seed member user: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'captain'), ($1, $3, 'member')`,
		teamID, userID, memberID); err != nil {
		t.Fatalf("seed team members: %v", err)
	}

	now := time.Date(2026, 7, 20, 12, 0, 0, 0, time.UTC)
	registration, err := domain.NewRegistration(groups[0].ID, userID, domain.RegistrationAttending, 1, now)
	if err != nil {
		t.Fatalf("new registration: %v", err)
	}
	if err := repository.CreateRegistration(ctx, registration); err != nil {
		t.Fatalf("create registration: %v", err)
	}

	entries, err := repository.ListRosterForGroup(ctx, groups[0])
	if err != nil {
		t.Fatalf("list roster: %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 roster entries, got %d: %+v", len(entries), entries)
	}
	attending := entries[0]
	if attending.UserID != userID || attending.Status == nil || *attending.Status != domain.RegistrationAttending {
		t.Fatalf("unexpected attending entry: %+v", attending)
	}
	if attending.MemberRole == nil || *attending.MemberRole != "captain" {
		t.Fatalf("expected captain role, got %+v", attending.MemberRole)
	}
	unregistered := entries[1]
	if unregistered.UserID != memberID || unregistered.Status != nil {
		t.Fatalf("expected unregistered member without status, got %+v", unregistered)
	}
	if unregistered.Nickname != "阿东" || unregistered.RealName == nil || *unregistered.RealName != "李东" {
		t.Fatalf("unexpected member profile: %+v", unregistered)
	}
}

func TestRepositoryListsIndividualGroupRegistrations(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	match, groups := newPersistableMatch(t, userID, teamID)
	now := time.Date(2026, 7, 19, 12, 0, 0, 0, time.UTC)
	individual := domain.NewIndividualGroup(match.ID, domain.IndividualLimits{MinPlayers: 8, MaxPlayers: 10}, now)
	groups = append(groups, individual)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}

	registration, err := domain.NewRegistration(individual.ID, userID, domain.RegistrationLeave, 1, now)
	if err != nil {
		t.Fatalf("new registration: %v", err)
	}
	if err := repository.CreateRegistration(ctx, registration); err != nil {
		t.Fatalf("create registration: %v", err)
	}

	entries, err := repository.ListRosterForGroup(ctx, individual)
	if err != nil {
		t.Fatalf("list roster: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 roster entry, got %d: %+v", len(entries), entries)
	}
	entry := entries[0]
	if entry.UserID != userID || entry.Status == nil || *entry.Status != domain.RegistrationLeave {
		t.Fatalf("unexpected individual entry: %+v", entry)
	}
	if entry.MemberRole != nil {
		t.Fatalf("individual entry must not carry member role, got %+v", entry.MemberRole)
	}
}

func TestRepositoryCreatesRegistration(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	match, groups := newPersistableMatch(t, userID, teamID)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}

	now := time.Date(2026, 7, 20, 12, 0, 0, 0, time.UTC)
	registration, err := domain.NewRegistration(groups[0].ID, userID, domain.RegistrationAttending, 1, now)
	if err != nil {
		t.Fatalf("new registration: %v", err)
	}
	if err := repository.CreateRegistration(ctx, registration); err != nil {
		t.Fatalf("create registration: %v", err)
	}

	var status string
	var count int
	err = pool.QueryRow(ctx,
		`SELECT status, registration_count FROM match_registrations WHERE group_id=$1 AND user_id=$2`,
		groups[0].ID, userID).Scan(&status, &count)
	if err != nil {
		t.Fatalf("query registration: %v", err)
	}
	if status != string(domain.RegistrationAttending) || count != 1 {
		t.Fatalf("unexpected registration: status=%s count=%d", status, count)
	}
}
