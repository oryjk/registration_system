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

func TestDecideNextVersionPrefersRegistryOverManifest(t *testing.T) {
	// 登记库是唯一权威：即使某台构建机的 manifest 版本更大（例如删过库或旧分支残留），
	// 也在库内最大版本基础上递增，保证多台机器分配结果一致、可被删库重置。
	seedAhead, _ := ParseVersion("2.0.0")
	decided := DecideNextVersion(AllocationInput{
		Latest: &MiniReviewStatus{Version: "1.34.23", VersionCode: 13423, IsReviewing: false},
		Seed:   seedAhead,
	})
	if decided.String() != "1.34.24" {
		t.Fatalf("expected registry-based 1.34.24, got %s", decided)
	}
}

func TestDecideNextVersionReusesReviewingLatestRegardlessOfSeed(t *testing.T) {
	// 库内最新仍在审核：任何构建机重复构建都复用它，本地 manifest 不影响复用判断。
	seed, _ := ParseVersion("1.35.0")
	decided := DecideNextVersion(AllocationInput{
		Latest: &MiniReviewStatus{Version: "1.34.24", VersionCode: 13424, IsReviewing: true},
		Seed:   seed,
	})
	if decided.String() != "1.34.24" {
		t.Fatalf("expected to reuse reviewing 1.34.24, got %s", decided)
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
