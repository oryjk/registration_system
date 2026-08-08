package legacymatches

import (
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/migration/mapping"
)

func TestRegistrationSourceIDUsesPostgresUserID(t *testing.T) {
	if got := registrationSourceID("activity-1", 901); got != "activity-1:901" {
		t.Fatalf("source ID=%q", got)
	}
}

func TestMapMatchStatusPreservesLifecycle(t *testing.T) {
	cases := map[int]domain.MatchStatus{
		0: domain.MatchRegistering,
		1: domain.MatchOngoing,
		2: domain.MatchEnded,
		3: domain.MatchCancelled,
	}
	for source, want := range cases {
		if got := mapMatchStatus(source); got != want {
			t.Fatalf("source status %d: got %q want %q", source, got, want)
		}
	}
}

func TestNormalizeMatchRunOptionsDefaultsToIncremental(t *testing.T) {
	options, err := normalizeRunOptions(RunOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if options.Mode != mapping.ModeIncremental {
		t.Fatalf("mode=%q", options.Mode)
	}
}

func TestLegacyMatchFingerprintChangesOnlyWithMigratedFields(t *testing.T) {
	now := time.Date(2026, 8, 8, 8, 0, 0, 0, time.UTC)
	match := LegacyMatch{
		SourceID: "activity-1", Name: " 周末友谊赛 ", Opposing: " 待定 ", Status: 0,
		PlayersPerTeam: 8, StartTime: now, EndTime: now.Add(time.Hour), Location: " 球场 ",
		HomeTeamSourceID: 1, UpdatedAt: now,
	}
	first, err := sourceMatchFingerprint(match)
	if err != nil {
		t.Fatal(err)
	}
	match.CreatedAt = now.Add(time.Hour)
	second, err := sourceMatchFingerprint(match)
	if err != nil {
		t.Fatal(err)
	}
	if first != second {
		t.Fatal("created_at must not affect version-one match fingerprint")
	}
	match.Status = 2
	third, err := sourceMatchFingerprint(match)
	if err != nil {
		t.Fatal(err)
	}
	if first == third {
		t.Fatal("status change must affect match fingerprint")
	}
}
