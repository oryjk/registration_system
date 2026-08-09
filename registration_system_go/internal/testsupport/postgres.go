package testsupport

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

// OpenTestPostgres uses only an explicitly configured isolated test database.
// It never falls back to DATABASE_URL and never starts a container.
func OpenTestPostgres(t *testing.T) *pgxpool.Pool {
	t.Helper()
	databaseURL := strings.TrimSpace(os.Getenv("TEST_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not configured; skipping PostgreSQL integration test")
	}
	runMigrations(t, databaseURL)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatalf("open TEST_DATABASE_URL: %v", err)
	}
	t.Cleanup(pool.Close)
	if err := pool.Ping(context.Background()); err != nil {
		t.Fatalf("ping TEST_DATABASE_URL: %v", err)
	}
	return pool
}

func StartPostgres(t *testing.T) *pgxpool.Pool {
	t.Helper()
	return OpenTestPostgres(t)
}

func runMigrations(t *testing.T, databaseURL string) {
	t.Helper()
	database, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatalf("open migration database: %v", err)
	}
	defer database.Close()

	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("resolve test support source path")
	}
	migrationDir := filepath.Clean(filepath.Join(filepath.Dir(currentFile), "..", "..", "db", "migrations"))
	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatalf("set goose dialect: %v", err)
	}
	if err := goose.Up(database, migrationDir); err != nil {
		t.Fatalf("run migrations from %s: %v", migrationDir, err)
	}
}
