package legacyteams

import (
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/migration/mapping"
)

func TestLegacyTeamFingerprintChangesOnlyWithMigratedFields(t *testing.T) {
	now := time.Date(2026, 8, 8, 1, 2, 3, 0, time.UTC)
	user := LegacyUser{ID: 10, OpenID: " openid ", Nickname: " 王睿 ", RealName: " 王睿 ", Status: 1, UpdatedAt: now}
	first, err := sourceUserFingerprint(user)
	if err != nil {
		t.Fatal(err)
	}
	user.Nickname = "新昵称"
	second, err := sourceUserFingerprint(user)
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("nickname change must change fingerprint")
	}
	user.Nickname = " 王睿 "
	user.CreatedAt = now.Add(time.Hour)
	third, err := sourceUserFingerprint(user)
	if err != nil {
		t.Fatal(err)
	}
	if first != third {
		t.Fatal("created_at is not a version-one migrated fingerprint field")
	}
}

func TestNormalizeRunOptionsDefaultsToIncremental(t *testing.T) {
	options, err := normalizeRunOptions(RunOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if options.Mode != mapping.ModeIncremental {
		t.Fatalf("mode=%q", options.Mode)
	}
	if _, err := normalizeRunOptions(RunOptions{Mode: "truncate"}); err == nil {
		t.Fatal("expected invalid mode")
	}
}
