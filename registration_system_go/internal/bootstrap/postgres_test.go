package bootstrap

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestPostgresPoolUsesUTCSessionRegardlessOfDSNTimezone(t *testing.T) {
	config, err := postgresPoolConfig("postgres://localhost/test?timezone=Asia%2FShanghai&application_name=registration-test")
	if err != nil {
		t.Fatal(err)
	}
	if got := config.ConnConfig.RuntimeParams["timezone"]; got != "UTC" {
		t.Fatalf("timestamp wall-clock columns require UTC sessions, got %q", got)
	}
	if got := config.ConnConfig.RuntimeParams["application_name"]; got != "registration-test" {
		t.Fatalf("other connection parameters must be preserved, got %q", got)
	}
}

func TestPostgresTimestampScansUseUTCForAPI(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	config, err := postgresPoolConfig(pool.Config().ConnString())
	if err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = pool.Config().ConnConfig.RuntimeParams["search_path"]
	utcPool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		t.Fatal(err)
	}
	defer utcPool.Close()
	var instant time.Time
	if err := utcPool.QueryRow(context.Background(), `SELECT '2025-12-31T16:30:00Z'::timestamptz`).Scan(&instant); err != nil {
		t.Fatal(err)
	}
	if got := instant.Format(time.RFC3339); got != "2025-12-31T16:30:00Z" || instant.Location() != time.UTC {
		t.Fatalf("database time must serialize as UTC independently of host timezone: %s (%s)", got, instant.Location())
	}
}
