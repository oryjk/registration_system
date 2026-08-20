package domain

import (
	"errors"
	"strings"
	"testing"
	"time"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestNewTipOrderAcceptsAnyPositiveAmount(t *testing.T) {
	now := time.Now()
	minimum, err := NewTipOrder("P202608200001", 37, 1, now)
	if err != nil {
		t.Fatalf("NewTipOrder() minimum error = %v", err)
	}
	if minimum.Kind != KindTip || minimum.Status != StatusPending || minimum.TeamID != nil || minimum.MatchID != nil {
		t.Fatalf("minimum order = %+v", minimum)
	}
	// 打赏金额不设上限：曾限制 1000 元，产品决策改为用户自由填写。
	generous, err := NewTipOrder("P202608200002", 37, 100_001, now)
	if err != nil {
		t.Fatalf("NewTipOrder() over old limit error = %v", err)
	}
	if generous.AmountCents != 100_001 {
		t.Fatalf("generous amount = %d", generous.AmountCents)
	}
}

func TestNewTipOrderRejectsNonPositiveAmount(t *testing.T) {
	now := time.Now()
	if _, err := NewTipOrder("P202608200003", 37, 0, now); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("zero amount error = %v, want validation", err)
	}
	if _, err := NewTipOrder("  ", 37, 100, now); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("blank order no error = %v, want validation", err)
	}
	if _, err := NewTipOrder("P202608200005", 0, 100, now); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("invalid user error = %v, want validation", err)
	}
}

func TestNewTipSnapshotsOrderWithSuggestion(t *testing.T) {
	now := time.Now()
	order, err := NewTipOrder("P202608200006", 37, 500, now)
	if err != nil {
		t.Fatal(err)
	}
	tip, err := NewTip(order, " 小王 ", " 希望支持赛事回放 ")
	if err != nil {
		t.Fatal(err)
	}
	if tip.OrderNo != order.OrderNo || tip.UserID != 37 || tip.Nickname != "小王" || tip.AmountCents != 500 {
		t.Fatalf("tip = %+v", tip)
	}
	if tip.Suggestion != "希望支持赛事回放" || tip.Status != TipStatusPending || tip.SubmittedAt != nil {
		t.Fatalf("tip = %+v", tip)
	}
}

func TestNewTipRejectsNonTipOrderAndOverlongSuggestion(t *testing.T) {
	now := time.Now()
	recharge, err := NewRechargeOrder("P202608200007", 37, 100, now)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := NewTip(recharge, "小王", ""); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("non-tip order error = %v, want validation", err)
	}

	tip, err := NewTipOrder("P202608200008", 37, 100, now)
	if err != nil {
		t.Fatal(err)
	}
	overlong := strings.Repeat("建", MaxTipSuggestionRunes+1)
	if _, err := NewTip(tip, "小王", overlong); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("overlong suggestion error = %v, want validation", err)
	}
	if _, err := NewTip(tip, "小王", strings.Repeat("建", MaxTipSuggestionRunes)); err != nil {
		t.Fatalf("boundary suggestion error = %v", err)
	}
}
