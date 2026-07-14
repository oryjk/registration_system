package testsupport

import (
	"context"
	"testing"

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
