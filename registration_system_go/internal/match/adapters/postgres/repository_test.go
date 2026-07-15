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
