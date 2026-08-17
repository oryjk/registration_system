package domain

import (
	"testing"
	"time"
)

func TestParseVersionEncodesAndValidates(t *testing.T) {
	version, err := ParseVersion("1.34.23")
	if err != nil {
		t.Fatalf("parse version: %v", err)
	}
	if version.String() != "1.34.23" || version.Code() != 13423 {
		t.Fatalf("unexpected version: %+v code=%d", version, version.Code())
	}

	for _, invalid := range []string{"1.2", "v1.2.3", "1.2.3.4", "1.100.0", "1.2.100", "1.-2.3", ""} {
		if _, err := ParseVersion(invalid); err == nil {
			t.Fatalf("expected %q to be rejected", invalid)
		}
	}
}

func TestNextPatchCarriesAtSegmentLimit(t *testing.T) {
	cases := []struct {
		current, next string
	}{
		{"1.34.23", "1.34.24"},
		{"1.0.99", "1.1.0"},
		{"1.99.99", "2.0.0"},
	}
	for _, tc := range cases {
		current, _ := ParseVersion(tc.current)
		if got := current.NextPatch().String(); got != tc.next {
			t.Fatalf("next patch of %s: got %s want %s", tc.current, got, tc.next)
		}
	}
}

func TestDecideNextVersionReusesReviewingLatest(t *testing.T) {
	seed, _ := ParseVersion("1.34.23")
	decided := DecideNextVersion(AllocationInput{
		Latest: &MiniReviewStatus{Version: "1.34.24", VersionCode: 13424, IsReviewing: true},
		Seed:   seed,
	})
	if decided.String() != "1.34.24" {
		t.Fatalf("expected to reuse reviewing 1.34.24, got %s", decided)
	}
}

func TestDecideNextVersionIncrementsApprovedLatest(t *testing.T) {
	seed, _ := ParseVersion("1.34.23")
	decided := DecideNextVersion(AllocationInput{
		Latest: &MiniReviewStatus{Version: "1.34.23", VersionCode: 13423, IsReviewing: false},
		Seed:   seed,
	})
	if decided.String() != "1.34.24" {
		t.Fatalf("expected 1.34.24, got %s", decided)
	}
}

func TestDecideNextVersionSeedsFromManifestWhenHistoryMissing(t *testing.T) {
	seed, _ := ParseVersion("1.0.38")
	decided := DecideNextVersion(AllocationInput{Seed: seed})
	if decided.String() != "1.0.39" {
		t.Fatalf("expected seed+patch 1.0.39, got %s", decided)
	}
}

func TestDecideNextVersionPrefersSeedWhenManifestIsAhead(t *testing.T) {
	// manifest 已被显式指定为更大版本（CI 场景）：以种子为基准递增，而不是库内旧记录。
	seedAhead, _ := ParseVersion("2.0.0")
	decided := DecideNextVersion(AllocationInput{
		Latest: &MiniReviewStatus{Version: "1.34.23", VersionCode: 13423, IsReviewing: false},
		Seed:   seedAhead,
	})
	if decided.String() != "2.0.1" {
		t.Fatalf("expected 2.0.1, got %s", decided)
	}
}

func TestDecideNextVersionIgnoresStaleReviewingLatest(t *testing.T) {
	// 库内最新仍在审核，但构建侧种子已经超过它（例如人工把 manifest 改大）：不再复用旧审核版本。
	seed, _ := ParseVersion("1.35.0")
	decided := DecideNextVersion(AllocationInput{
		Latest: &MiniReviewStatus{Version: "1.34.24", VersionCode: 13424, IsReviewing: true},
		Seed:   seed,
	})
	if decided.String() != "1.35.1" {
		t.Fatalf("expected 1.35.1, got %s", decided)
	}
}

func TestStatusTransitionsValidateText(t *testing.T) {
	now := time.Date(2026, 8, 18, 10, 0, 0, 0, time.UTC)
	status := NewReviewingStatus("registration_system_mini", mustVersion(t, "1.0.39"), now)
	if !status.IsReviewing || status.StatusText != "正在审核" {
		t.Fatalf("unexpected new status: %+v", status)
	}

	if err := status.SetStatus(false, "  ", now); err == nil {
		t.Fatal("blank status text must be rejected")
	}
	if err := status.SetStatus(false, "审核通过", now); err != nil {
		t.Fatalf("set approved: %v", err)
	}
	if status.IsReviewing || status.StatusText != "审核通过" {
		t.Fatalf("unexpected approved status: %+v", status)
	}

	status.RestartReviewing(now)
	if !status.IsReviewing || status.StatusText != "正在审核" {
		t.Fatalf("unexpected restarted status: %+v", status)
	}
}

func mustVersion(t *testing.T, raw string) Version {
	t.Helper()
	version, err := ParseVersion(raw)
	if err != nil {
		t.Fatalf("parse %s: %v", raw, err)
	}
	return version
}
