package main

import (
	"strings"
	"testing"

	"github.com/oryjk/registration_system/registration_system_go/internal/migration/legacyteams"
	"github.com/oryjk/registration_system/registration_system_go/internal/migration/mapping"
)

func TestParseOptionsDefaultsToIncremental(t *testing.T) {
	options, err := parseOptions(nil)
	if err != nil {
		t.Fatal(err)
	}
	if options.mode != mapping.ModeIncremental || options.dryRun {
		t.Fatalf("unexpected defaults: %#v", options)
	}
	if options.mappingFile != "config/legacy-import-mappings.json" {
		t.Fatalf("mapping file=%q", options.mappingFile)
	}
}

func TestParseOptionsAcceptsFullDryRunAndMappingFile(t *testing.T) {
	options, err := parseOptions([]string{"--mode=full", "--dry-run", "--mapping-file=/tmp/mappings.json"})
	if err != nil {
		t.Fatal(err)
	}
	if options.mode != mapping.ModeFull || !options.dryRun || options.mappingFile != "/tmp/mappings.json" {
		t.Fatalf("unexpected options: %#v", options)
	}
}

func TestParseOptionsRejectsUnknownMode(t *testing.T) {
	if _, err := parseOptions([]string{"--mode=truncate"}); err == nil {
		t.Fatal("expected invalid mode error")
	}
}

func TestFormatReportContainsCountsOnly(t *testing.T) {
	report := legacyteams.Report{
		UsersInserted:             1,
		UsersSkipped:              2,
		TeamsTargetModified:       3,
		MembershipsInactivated:    4,
		MembershipsTargetModified: 5,
		Conflicts:                 6,
	}
	output := formatReport(cliOptions{dryRun: true, mode: mapping.ModeFull}, report)
	for _, want := range []string{
		"dry_run=true", "mode=full", "users_inserted=1", "users_skipped=2",
		"teams_target_modified=3", "memberships_inactivated=4",
		"memberships_target_modified=5", "conflicts=6",
	} {
		if !strings.Contains(output, want) {
			t.Fatalf("report %q does not contain %q", output, want)
		}
	}
}
