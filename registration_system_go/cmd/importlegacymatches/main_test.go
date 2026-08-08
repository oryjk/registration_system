package main

import (
	"strings"
	"testing"

	"github.com/oryjk/registration_system/registration_system_go/internal/migration/legacymatches"
	"github.com/oryjk/registration_system/registration_system_go/internal/migration/mapping"
)

func TestParseOptionsRequiresAuditedTargetIDs(t *testing.T) {
	if _, err := parseOptions(nil); err == nil {
		t.Fatal("expected required target ID error")
	}
	options, err := parseOptions([]string{"--host-team-id=11", "--captain-user-id=37", "--legacy-team-id=1"})
	if err != nil {
		t.Fatal(err)
	}
	if options.mode != mapping.ModeIncremental || options.mappingFile != "config/legacy-import-mappings.json" {
		t.Fatalf("unexpected defaults: %#v", options)
	}
}

func TestParseOptionsAcceptsFullDryRun(t *testing.T) {
	options, err := parseOptions([]string{
		"--host-team-id=11", "--captain-user-id=37", "--legacy-team-id=1",
		"--mode=full", "--dry-run", "--mapping-file=/tmp/mappings.json",
	})
	if err != nil {
		t.Fatal(err)
	}
	if options.mode != mapping.ModeFull || !options.dryRun || options.mappingFile != "/tmp/mappings.json" {
		t.Fatalf("unexpected options: %#v", options)
	}
}

func TestFormatReportIncludesReconciliationCounts(t *testing.T) {
	report := legacymatches.Report{
		UsersSkipped: 1, MatchesTargetModified: 2, RegistrationsCancelled: 3,
		OrphanReferences: 4, Conflicts: 5,
	}
	output := formatReport(cliOptions{mode: mapping.ModeFull, dryRun: true}, report)
	for _, want := range []string{"mode=full", "dry_run=true", "users_skipped=1", "matches_target_modified=2", "registrations_cancelled=3", "orphan_references=4", "conflicts=5"} {
		if !strings.Contains(output, want) {
			t.Fatalf("report %q does not contain %q", output, want)
		}
	}
}
