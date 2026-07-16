package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oryjk/registration_system/registration_system_go/internal/migration/legacyteams"
	"github.com/oryjk/registration_system/registration_system_go/internal/shared/configenv"
)

func main() {
	dryRun := flag.Bool("dry-run", false, "validate and roll back target writes")
	flag.Parse()
	configenv.Load()
	if err := run(context.Background(), *dryRun); err != nil {
		slog.Error("legacy team import failed", "error", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, dryRun bool) error {
	port, err := strconv.Atoi(requiredEnv("LEGACY_MYSQL_PORT"))
	if err != nil || port <= 0 {
		return fmt.Errorf("LEGACY_MYSQL_PORT must be a positive integer")
	}
	mysqlConfig := mysql.NewConfig()
	mysqlConfig.User = requiredEnv("LEGACY_MYSQL_USER")
	mysqlConfig.Passwd = requiredEnv("LEGACY_MYSQL_PASSWORD")
	mysqlConfig.Net = "tcp"
	mysqlConfig.Addr = fmt.Sprintf("%s:%d", requiredEnv("LEGACY_MYSQL_HOST"), port)
	mysqlConfig.DBName = requiredEnv("LEGACY_MYSQL_DATABASE")
	mysqlConfig.ParseTime = true
	mysqlConfig.Collation = "utf8mb4_unicode_ci"
	mysqlConfig.Timeout = 10 * time.Second

	sourceDB, err := sql.Open("mysql", mysqlConfig.FormatDSN())
	if err != nil {
		return fmt.Errorf("open legacy MySQL: %w", err)
	}
	defer sourceDB.Close()
	target, err := pgxpool.New(ctx, requiredEnv("DATABASE_URL"))
	if err != nil {
		return fmt.Errorf("open target PostgreSQL: %w", err)
	}
	defer target.Close()

	report, err := legacyteams.NewImporter(target, legacyteams.NewMySQLSource(sourceDB)).Run(ctx, dryRun)
	if err != nil {
		return err
	}
	fmt.Printf("dry_run=%t users_inserted=%d users_updated=%d teams_inserted=%d teams_updated=%d memberships_inserted=%d memberships_updated=%d\n",
		dryRun, report.UsersInserted, report.UsersUpdated, report.TeamsInserted, report.TeamsUpdated, report.MembershipsInserted, report.MembershipsUpdated)
	return nil
}

func requiredEnv(name string) string {
	value := os.Getenv(name)
	if value == "" {
		slog.Error("required environment variable is missing", "name", name)
		os.Exit(1)
	}
	return value
}
