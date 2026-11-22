package domain

import (
	"errors"
	"testing"
	"time"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestResolveVipPlanAndCatalog(t *testing.T) {
	catalog := VipPlanCatalog()
	if len(catalog) != 3 {
		t.Fatalf("len(catalog) = %d, want 3", len(catalog))
	}
	// 修改返回切片不影响内部定义。
	catalog[0].PriceCents = 1
	if again := VipPlanCatalog(); again[0].PriceCents != 900 {
		t.Fatalf("catalog mutated: got %d", again[0].PriceCents)
	}

	cases := []struct {
		input        string
		wantCode     VipPlan
		wantCents    int64
		wantDays     int
		wantCredits  int
		wantBadge    string
		wantNotEmpty bool
	}{
		{input: "once", wantCode: VipPlanOnce, wantCents: 900, wantDays: 0, wantCredits: 1},
		{input: " MONTHLY ", wantCode: VipPlanMonthly, wantCents: 1900, wantDays: 30, wantCredits: 0},
		{input: "yearly", wantCode: VipPlanYearly, wantCents: 9900, wantDays: 365, wantCredits: 0, wantBadge: "推荐"},
	}
	for _, tc := range cases {
		spec, err := ResolveVipPlan(tc.input)
		if err != nil {
			t.Fatalf("ResolveVipPlan(%q) error = %v", tc.input, err)
		}
		if spec.Code != tc.wantCode || spec.PriceCents != tc.wantCents || spec.DurationDays != tc.wantDays || spec.Credits != tc.wantCredits || spec.Badge != tc.wantBadge || spec.Name == "" || spec.Description == "" {
			t.Fatalf("ResolveVipPlan(%q) = %+v", tc.input, spec)
		}
	}

	if _, err := ResolveVipPlan("lifetime"); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("invalid plan error = %v, want validation", err)
	}
	if _, err := ResolveVipPlan(""); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("empty plan error = %v, want validation", err)
	}
}

func TestComputeNextVipUntil(t *testing.T) {
	now := time.Date(2026, 11, 23, 12, 0, 0, 0, time.UTC)

	// 从未开通：从 now 起算 30 天。
	got := ComputeNextVipUntil(nil, now, 30)
	want := now.Add(30 * 24 * time.Hour)
	if !got.Equal(want) {
		t.Fatalf("nil current: got %v, want %v", got, want)
	}

	// 已过期：从 now 起算 365 天。
	expired := now.Add(-2 * time.Hour)
	got = ComputeNextVipUntil(&expired, now, 365)
	want = now.Add(365 * 24 * time.Hour)
	if !got.Equal(want) {
		t.Fatalf("expired current: got %v, want %v", got, want)
	}

	// 未过期：在原 vip_until 上顺延。
	active := now.Add(10 * 24 * time.Hour)
	got = ComputeNextVipUntil(&active, now, 30)
	want = active.Add(30 * 24 * time.Hour)
	if !got.Equal(want) {
		t.Fatalf("active current: got %v, want %v", got, want)
	}
}

func TestVipStatusHasCustomShareBgAccess(t *testing.T) {
	now := time.Date(2026, 11, 23, 12, 0, 0, 0, time.UTC)
	future := now.Add(24 * time.Hour)
	past := now.Add(-24 * time.Hour)

	if !(VipStatus{TeamID: 1, VipUntil: &future}).HasCustomShareBgAccess(now, false) {
		t.Fatal("active vip should have access")
	}
	if !(VipStatus{TeamID: 1, VipUntil: &past}).HasCustomShareBgAccess(now, true) {
		t.Fatal("match already unlocked should have access even if vip expired")
	}
	if (VipStatus{TeamID: 1, VipUntil: &past, VipCredits: 2}).HasCustomShareBgAccess(now, false) {
		t.Fatal("credits alone must not bypass credit consumption check")
	}
	if (VipStatus{TeamID: 1}).HasCustomShareBgAccess(now, false) {
		t.Fatal("free team without unlocked match should not have direct access")
	}
}
