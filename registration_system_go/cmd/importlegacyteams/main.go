package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oryjk/registration_system/registration_system_go/internal/migration/legacyteams"
	"github.com/oryjk/registration_system/registration_system_go/internal/migration/mapping"
	"github.com/oryjk/registration_system/registration_system_go/internal/shared/configenv"
)

type cliOptions struct {
	dryRun      bool
	mode        mapping.Mode
	mappingFile string
}

func main() {
	options, err := parseOptions(os.Args[1:])
	if err != nil {
		slog.Error("invalid legacy team import options", "error", err)
		os.Exit(2)
	}
	configenv.Load()
	if err := run(context.Background(), options); err != nil {
		slog.Error("legacy team import failed", "error", err)
		os.Exit(1)
	}
}

func parseOptions(args []string) (cliOptions, error) {
	flags := flag.NewFlagSet("importlegacyteams", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	modeValue := flags.String("mode", string(mapping.ModeIncremental), "incremental or full")
	dryRun := flags.Bool("dry-run", false, "validate and roll back target writes")
	mappingFile := flags.String("mapping-file", "config/legacy-import-mappings.json", "non-sensitive explicit ID mapping JSON")
	if err := flags.Parse(args); err != nil {
		return cliOptions{}, err
	}
	mode, err := mapping.ParseMode(*modeValue)
	if err != nil {
		return cliOptions{}, err
	}
	if *mappingFile == "" {
		return cliOptions{}, fmt.Errorf("mapping-file must not be empty")
	}
	return cliOptions{dryRun: *dryRun, mode: mode, mappingFile: *mappingFile}, nil
}

func run(ctx context.Context, options cliOptions) error {
	explicitMappings, err := mapping.LoadConfig(options.mappingFile)
	if err != nil {
		return err
	}
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

	report, err := legacyteams.NewImporter(target, legacyteams.NewMySQLSource(sourceDB)).RunWithOptions(ctx, legacyteams.RunOptions{
		DryRun:           options.dryRun,
		Mode:             options.mode,
		ExplicitMappings: explicitMappings,
	})
	if err != nil {
		return err
	}
	fmt.Println(formatReport(options, report))
	return nil
}

func formatReport(options cliOptions, report legacyteams.Report) string {
	return fmt.Sprintf(
		"dry_run=%t mode=%s users_inserted=%d users_updated=%d users_skipped=%d users_target_modified=%d teams_inserted=%d teams_updated=%d teams_skipped=%d teams_target_modified=%d memberships_inserted=%d memberships_updated=%d memberships_skipped=%d memberships_target_modified=%d memberships_inactivated=%d conflicts=%d",
		options.dryRun, options.mode,
		report.UsersInserted, report.UsersUpdated, report.UsersSkipped, report.UsersTargetModified,
		report.TeamsInserted, report.TeamsUpdated, report.TeamsSkipped, report.TeamsTargetModified,
		report.MembershipsInserted, report.MembershipsUpdated, report.MembershipsSkipped,
		report.MembershipsTargetModified, report.MembershipsInactivated, report.Conflicts,
	)
}

func requiredEnv(name string) string {
	value := os.Getenv(name)
	if value == "" {
		slog.Error("required environment variable is missing", "name", name)
		os.Exit(1)
	}
	return value
}
