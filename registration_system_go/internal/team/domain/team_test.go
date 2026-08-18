package domain

import (
	"testing"
	"time"
)

func TestTrustLabelReflectsScoreBandAndVip(t *testing.T) {
	cases := []struct {
		score int
		vip   bool
		want  string
	}{
		{92, true, "会员·金牌信用"},
		{90, false, "金牌信用"},
		{82, false, "稳定赴约"},
		{75, false, "评价稳定"},
		{65, false, "待观察"},
		{40, false, "风险较高"},
	}
	for _, tc := range cases {
		if got := TrustLabel(tc.score, tc.vip); got != tc.want {
			t.Fatalf("TrustLabel(%d, %v) = %q, want %q", tc.score, tc.vip, got, tc.want)
		}
	}
}

func TestIsVipActive(t *testing.T) {
	now := time.Now()
	active := now.Add(24 * time.Hour)
	expired := now.Add(-24 * time.Hour)
	if !IsVipActive(&active, now) {
		t.Fatal("future vip_until should be vip")
	}
	if IsVipActive(&expired, now) {
		t.Fatal("expired vip_until should not be vip")
	}
	if IsVipActive(nil, now) {
		t.Fatal("nil vip_until should not be vip")
	}
}
