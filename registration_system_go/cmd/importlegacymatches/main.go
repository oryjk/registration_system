package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oryjk/registration_system/registration_system_go/internal/migration/legacymatches"
	"github.com/oryjk/registration_system/registration_system_go/internal/migration/mapping"
	"github.com/oryjk/registration_system/registration_system_go/internal/shared/configenv"
)

type cliOptions struct {
	dryRun        bool
	mode          mapping.Mode
	mappingFile   string
	hostTeamID    int64
	captainUserID int64
	legacyTeamID  int64
}

func main() {
	options, err := parseOptions(os.Args[1:])
	if err != nil {
		slog.Error("invalid legacy match import options", "error", err)
		os.Exit(2)
	}
	configenv.Load()
	if err := run(context.Background(), options); err != nil {
		slog.Error("legacy match import failed", "error", err)
		os.Exit(1)
	}
}

func parseOptions(args []string) (cliOptions, error) {
	flags := flag.NewFlagSet("importlegacymatches", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	dryRun := flags.Bool("dry-run", false, "validate and roll back target writes")
	modeValue := flags.String("mode", string(mapping.ModeIncremental), "incremental or full")
	mappingFile := flags.String("mapping-file", "config/legacy-import-mappings.json", "non-sensitive explicit ID mapping JSON")
	hostTeamID := flags.Int64("host-team-id", 0, "目标库主队 ID（洺悦御府）")
	captainUserID := flags.Int64("captain-user-id", 0, "目标库用作历史比赛 created_by 的队长用户 ID")
	legacyTeamID := flags.Int64("legacy-team-id", 0, "源库球队 ID（东安洺悦联队）")
	if err := flags.Parse(args); err != nil {
		return cliOptions{}, err
	}
	mode, err := mapping.ParseMode(*modeValue)
	if err != nil {
		return cliOptions{}, err
	}
	options := cliOptions{dryRun: *dryRun, mode: mode, mappingFile: *mappingFile, hostTeamID: *hostTeamID, captainUserID: *captainUserID, legacyTeamID: *legacyTeamID}
	if options.hostTeamID <= 0 {
		return cliOptions{}, fmt.Errorf("-host-team-id must be a positive integer (target 洺悦御府 team id)")
	}
	if options.captainUserID <= 0 {
		return cliOptions{}, fmt.Errorf("-captain-user-id must be a positive integer (target captain user id)")
	}
	if options.legacyTeamID <= 0 {
		return cliOptions{}, fmt.Errorf("-legacy-team-id must be a positive integer")
	}
	if options.mappingFile == "" {
		return cliOptions{}, fmt.Errorf("mapping-file must not be empty")
	}
	return options, nil
}

func run(ctx context.Context, options cliOptions) error {
	explicitMappings, err := mapping.LoadConfig(options.mappingFile)
	if err != nil {
		return err
	}
	if configured, ok := explicitMappings.Lookup(mapping.SourceLegacyMySQL, mapping.EntityTeam, strconv.FormatInt(options.legacyTeamID, 10)); ok && configured != strconv.FormatInt(options.hostTeamID, 10) {
		return fmt.Errorf("host-team-id %d conflicts with mapped legacy team target %s", options.hostTeamID, configured)
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

	report, err := legacymatches.NewImporter(targetPool, legacymatches.NewPostgresSource(sourcePool, options.legacyTeamID), options.hostTeamID, options.captainUserID).RunWithOptions(ctx, legacymatches.RunOptions{
		DryRun: options.dryRun, Mode: options.mode, ExplicitMappings: explicitMappings,
	})
	if err != nil {
		return err
	}
	fmt.Println(formatReport(options, report))
	return nil
}

func formatReport(options cliOptions, report legacymatches.Report) string {
	return fmt.Sprintf(
		"dry_run=%t mode=%s users_inserted=%d users_updated=%d users_skipped=%d users_target_modified=%d matches_inserted=%d matches_updated=%d matches_skipped=%d matches_target_modified=%d registrations_inserted=%d registrations_updated=%d registrations_skipped=%d registrations_target_modified=%d registrations_cancelled=%d pending_team_created=%t orphan_references=%d conflicts=%d",
		options.dryRun, options.mode,
		report.UsersInserted, report.UsersUpdated, report.UsersSkipped, report.UsersTargetModified,
		report.MatchesInserted, report.MatchesUpdated, report.MatchesSkipped, report.MatchesTargetModified,
		report.RegistrationsInserted, report.RegistrationsUpdated, report.RegistrationsSkipped,
		report.RegistrationsTargetModified, report.RegistrationsCancelled, report.PendingTeamCreated,
		report.OrphanReferences, report.Conflicts,
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
