package testsupport

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func TestInitialSchemaContainsMatchAggregateTables(t *testing.T) {
	pool := StartPostgres(t)
	for _, table := range []string{
		"users",
		"teams",
		"team_members",
		"matches",
		"match_registration_groups",
		"match_registrations",
		"match_team_applications",
		"match_registration_defaults",
	} {
		requireTable(t, pool, table)
	}
	requireCheckConstraint(t, pool, "matches", "matches_publication_mode_check")
}

func TestUserProfileColumns(t *testing.T) {
	pool := StartPostgres(t)
	requireNullableColumn(t, pool, "users", "real_name", "character varying")
	requireNullableColumn(t, pool, "users", "phone_number", "character varying")
}

// TestLegacyMatchCompatConstraints pins the relaxed constraints introduced by
// migration 00004 so historical imports can store offline-confirmed matches
// that reference a real (or placeholder) away team, plus registrations whose
// status is "unknown" (source stand=0, never responded).
func TestLegacyMatchCompatConstraints(t *testing.T) {
	pool := StartPostgres(t)
	ctx := context.Background()

	hostTeam := seedTeam(t, pool, ctx, "legacy-host")
	awayTeam := seedTeam(t, pool, ctx, "legacy-away")
	creator := seedUser(t, pool, ctx, "legacy-openid")

	// offline_confirmed match with a non-null away_team_id must now be accepted.
	var matchID string
	err := pool.QueryRow(ctx, `
        INSERT INTO matches (id, name, publication_mode, opponent_state, status,
            host_team_id, away_team_id, opponent_name, players_per_team,
            start_time, end_time, location, created_by_user_id)
        VALUES ($1, $2, 'offline_confirmed', 'no_recruitment', 'ended',
            $3, $4, $5, 8, NOW(), NOW() + INTERVAL '1 hour', '场地', $6)
        RETURNING id`, pgUUID(), "历史比赛", hostTeam, awayTeam, "对手", creator).Scan(&matchID)
	if err != nil {
		t.Fatalf("offline_confirmed match with away_team_id rejected: %v", err)
	}

	var groupID string
	err = pool.QueryRow(ctx, `
        INSERT INTO match_registration_groups (id, match_id, kind, team_id, status)
        VALUES ($1, $2, 'host_team', $3, 'open') RETURNING id`,
		pgUUID(), matchID, hostTeam).Scan(&groupID)
	if err != nil {
		t.Fatalf("seed host registration group: %v", err)
	}

	// registration with status='unknown' must now be accepted.
	_, err = pool.Exec(ctx, `
        INSERT INTO match_registrations (id, group_id, user_id, status, registration_count)
        VALUES ($1, $2, $3, 'unknown', 1)`, pgUUID(), groupID, creator)
	if err != nil {
		t.Fatalf("registration with status=unknown rejected: %v", err)
	}
}

type queryer interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func requireTable(t *testing.T, database queryer, table string) {
	t.Helper()
	var exists bool
	err := database.QueryRow(
		context.Background(),
		`SELECT EXISTS (
           SELECT 1
           FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = $1
         )`,
		table,
	).Scan(&exists)
	if err != nil {
		t.Fatalf("query table %s: %v", table, err)
	}
	if !exists {
		t.Errorf("expected table %s to exist", table)
	}
}

func requireCheckConstraint(t *testing.T, database queryer, table, constraint string) {
	t.Helper()
	var exists bool
	err := database.QueryRow(
		context.Background(),
		`SELECT EXISTS (
           SELECT 1
           FROM pg_constraint c
           JOIN pg_class r ON r.oid = c.conrelid
           WHERE r.relname = $1 AND c.conname = $2 AND c.contype = 'c'
         )`,
		table,
		constraint,
	).Scan(&exists)
	if err != nil {
		t.Fatalf("query constraint %s: %v", constraint, err)
	}
	if !exists {
		t.Errorf("expected check constraint %s on %s", constraint, table)
	}
}

func requireNullableColumn(t *testing.T, database queryer, table, column, dataType string) {
	t.Helper()
	var actualType, nullable string
	err := database.QueryRow(
		context.Background(),
		`SELECT data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
		table,
		column,
	).Scan(&actualType, &nullable)
	if err != nil {
		t.Fatalf("query column %s.%s: %v", table, column, err)
	}
	if actualType != dataType || nullable != "YES" {
		t.Errorf("column %s.%s: type=%s nullable=%s", table, column, actualType, nullable)
	}
}

func seedTeam(t *testing.T, pool queryer, ctx context.Context, name string) int64 {
	t.Helper()
	var id int64
	err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ($1) RETURNING id`, name).Scan(&id)
	if err != nil {
		t.Fatalf("seed team %s: %v", name, err)
	}
	return id
}

func seedUser(t *testing.T, pool queryer, ctx context.Context, openID string) int64 {
	t.Helper()
	var id int64
	err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ($1) RETURNING id`, openID).Scan(&id)
	if err != nil {
		t.Fatalf("seed user %s: %v", openID, err)
	}
	return id
}

func pgUUID() string {
	return uuid.New().String()
}
