package main

import (
	"strings"
	"testing"
)

func TestParseOptionsRequiresPositiveIDs(t *testing.T) {
	if _, err := parseOptions([]string{"-legacy-team-id", "0"}); err == nil {
		t.Fatal("legacy-team-id=0 should be rejected")
	}
	if _, err := parseOptions([]string{"-captain-legacy-user-id", "-1"}); err == nil {
		t.Fatal("negative captain id should be rejected")
	}
	if _, err := parseOptions([]string{"-host-team-name", "  "}); err == nil {
		t.Fatal("blank host team name should be rejected")
	}
	options, err := parseOptions([]string{
		"-legacy-team-id", "1",
		"-host-team-id", "11",
		"-host-team-name", "洺悦御府",
		"-captain-legacy-user-id", "4",
	})
	if err != nil {
		t.Fatalf("valid options rejected: %v", err)
	}
	if options.legacyTeamID != 1 || options.hostTeamID != 11 || options.captainLegacyUserID != 4 || options.hostTeamName != "洺悦御府" {
		t.Fatalf("unexpected options: %+v", options)
	}
}

func TestCompareCountsDetectsEveryMismatch(t *testing.T) {
	expected := sourceCounts{Users: 36, Matches: 102, Registrations: 2059, Members: 35}

	if mismatch := compareCounts(expected, targetCounts{Users: 36, Matches: 102, Registrations: 2059, Members: 35}); mismatch != "" {
		t.Fatalf("matching counts should pass, got %q", mismatch)
	}
	if mismatch := compareCounts(expected, targetCounts{Users: 30, Matches: 102, Registrations: 2059, Members: 35}); !strings.Contains(mismatch, "用户数不一致") {
		t.Fatalf("user mismatch not reported: %q", mismatch)
	}
	if mismatch := compareCounts(expected, targetCounts{Users: 36, Matches: 101, Registrations: 2059, Members: 35}); !strings.Contains(mismatch, "比赛数不一致") {
		t.Fatalf("match mismatch not reported: %q", mismatch)
	}
	if mismatch := compareCounts(expected, targetCounts{Users: 36, Matches: 102, Registrations: 1860, Members: 35}); !strings.Contains(mismatch, "报名数不一致") {
		t.Fatalf("registration mismatch not reported: %q", mismatch)
	}
	if mismatch := compareCounts(expected, targetCounts{Users: 36, Matches: 102, Registrations: 2059, Members: 1}); !strings.Contains(mismatch, "成员数不一致") {
		t.Fatalf("member mismatch not reported: %q", mismatch)
	}
}

func TestReplaceDatabaseHandlesQueryAndBareURLs(t *testing.T) {
	cases := map[string]string{
		"postgres://u:p@host:15432/registration_system_go?sslmode=disable": "postgres://u:p@host:15432/postgres?sslmode=disable",
		"postgres://u:p@host:15432/registration_system_go":                 "postgres://u:p@host:15432/postgres",
	}
	for input, want := range cases {
		if got := replaceDatabase(input, "postgres"); got != want {
			t.Fatalf("replaceDatabase(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestParseOptionsSeedsDefaultSuperAdmin(t *testing.T) {
	options, err := parseOptions([]string{})
	if err != nil {
		t.Fatal(err)
	}
	if options.adminUsername != "admin" || options.adminPassword != "admin123" {
		t.Fatalf("unexpected default admin credentials: %q / %q", options.adminUsername, options.adminPassword)
	}
}

func TestParseOptionsRejectsShortAdminPassword(t *testing.T) {
	if _, err := parseOptions([]string{"-admin-password", "123"}); err == nil {
		t.Fatal("expected short admin password to be rejected")
	}
}
