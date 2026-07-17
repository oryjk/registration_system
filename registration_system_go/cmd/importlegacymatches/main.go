package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oryjk/registration_system/registration_system_go/internal/migration/legacymatches"
	"github.com/oryjk/registration_system/registration_system_go/internal/shared/configenv"
)

func main() {
	dryRun := flag.Bool("dry-run", false, "validate and roll back target writes")
	hostTeamID := flag.Int64("host-team-id", 0, "目标库主队 ID（洺悦御府）")
	captainUserID := flag.Int64("captain-user-id", 0, "目标库用作历史比赛 created_by 的队长用户 ID")
	legacyTeamID := flag.Int64("legacy-team-id", 1, "源库球队 ID（东安洺悦联队=1）")
	flag.Parse()
	configenv.Load()
	if err := run(context.Background(), *dryRun, *hostTeamID, *captainUserID, *legacyTeamID); err != nil {
		slog.Error("legacy match import failed", "error", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, dryRun bool, hostTeamID, captainUserID, legacyTeamID int64) error {
	if hostTeamID <= 0 {
		return fmt.Errorf("-host-team-id must be a positive integer (target 洺悦御府 team id)")
	}
	if captainUserID <= 0 {
		return fmt.Errorf("-captain-user-id must be a positive integer (target captain user id)")
	}
	if legacyTeamID <= 0 {
		return fmt.Errorf("-legacy-team-id must be a positive integer")
	}

	sourceURL := requiredEnv("LEGACY_PG_URL")
	targetURL := requiredEnv("DATABASE_URL")

	sourcePool, err := pgxpool.New(ctx, sourceURL)
	if err != nil {
		return fmt.Errorf("open legacy PostgreSQL: %w", err)
	}
	defer sourcePool.Close()
	targetPool, err := pgxpool.New(ctx, targetURL)
	if err != nil {
		return fmt.Errorf("open target PostgreSQL: %w", err)
	}
	defer targetPool.Close()

	report, err := legacymatches.NewImporter(targetPool, legacymatches.NewPostgresSource(sourcePool, legacyTeamID), hostTeamID, captainUserID).Run(ctx, dryRun)
	if err != nil {
		return err
	}
	fmt.Printf("dry_run=%t matches_inserted=%d matches_updated=%d registrations_inserted=%d registrations_updated=%d pending_team_created=%t unmapped_openids=%d\n",
		dryRun, report.MatchesInserted, report.MatchesUpdated,
		report.RegistrationsInserted, report.RegistrationsUpdated,
		report.PendingTeamCreated, report.UnmappedOpenIDs)
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
