package domain

import (
	"errors"
	"testing"
	"time"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestNewRechargeOrderRejectsAmountBelowOneCent(t *testing.T) {
	_, err := NewRechargeOrder("P202608090001", 37, 0, time.Now())
	if !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("NewRechargeOrder() error = %v, want validation", err)
	}
}

func TestOrderCannotBeCancelledAfterPayment(t *testing.T) {
	now := time.Now()
	order, err := NewRechargeOrder("P202608090002", 37, 1, now)
	if err != nil {
		t.Fatal(err)
	}
	if err := order.MarkPaid("wx-transaction-1", now.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if err := order.MarkCancelled(now.Add(2 * time.Minute)); !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("MarkCancelled() error = %v, want conflict", err)
	}
}

func TestMarkPaidIsIdempotentForSameTransaction(t *testing.T) {
	now := time.Now()
	order, err := NewRechargeOrder("P202608090003", 37, 100, now)
	if err != nil {
		t.Fatal(err)
	}
	if err := order.MarkPaid("wx-transaction-1", now.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if err := order.MarkPaid("wx-transaction-1", now.Add(2*time.Minute)); err != nil {
		t.Fatalf("second MarkPaid() error = %v", err)
	}
	if !order.PaidAt.Equal(now.Add(time.Minute)) {
		t.Fatalf("PaidAt changed on duplicate payment: %v", order.PaidAt)
	}
}

func TestMarkPaidRejectsDifferentProviderTransaction(t *testing.T) {
	now := time.Now()
	order, err := NewRechargeOrder("P202608090004", 37, 100, now)
	if err != nil {
		t.Fatal(err)
	}
	if err := order.MarkPaid("wx-transaction-1", now); err != nil {
		t.Fatal(err)
	}
	if err := order.MarkPaid("wx-transaction-2", now); !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("MarkPaid() error = %v, want conflict", err)
	}
}

func TestNewTeamMembershipOrderValidatesArbitraryAmount(t *testing.T) {
	now := time.Date(2026, 8, 17, 12, 0, 0, 0, time.UTC)
	order, err := NewTeamMembershipOrder("P-team-1", 42, 7, 7500, now)
	if err != nil {
		t.Fatal(err)
	}
	if order.Kind != KindTeamMembership || order.AmountCents != 7500 {
		t.Fatalf("unexpected order: %+v", order)
	}
	if order.TeamID == nil || *order.TeamID != 7 {
		t.Fatalf("membership fields missing: %+v", order)
	}
	if order.Months != nil {
		t.Fatalf("new team membership order should not carry months: %+v", order)
	}
	for _, amount := range []int64{0, -1, MembershipMaxAmountCents + 1} {
		if _, err := NewTeamMembershipOrder("P-team-2", 42, 7, amount, now); err == nil {
			t.Fatalf("expected amount=%d to be rejected", amount)
		}
	}
}

func TestNewTeamVipOrderValidatesFields(t *testing.T) {
	now := time.Date(2026, 11, 23, 12, 0, 0, 0, time.UTC)
	order, err := NewTeamVipOrder("P-vip-1", 42, 7, "yearly", 9900, now)
	if err != nil {
		t.Fatal(err)
	}
	if order.Kind != KindTeamVip || order.AmountCents != 9900 || order.TeamID == nil || *order.TeamID != 7 || order.VipPlan == nil || *order.VipPlan != "yearly" {
		t.Fatalf("unexpected team vip order: %+v", order)
	}
	if _, err := NewTeamVipOrder("P-vip-2", 42, 0, "once", 900, now); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("zero teamID err=%v", err)
	}
	if _, err := NewTeamVipOrder("P-vip-3", 42, 7, "   ", 900, now); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("blank plan err=%v", err)
	}
	if _, err := NewTeamVipOrder("P-vip-4", 42, 7, "once", 0, now); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("zero amount err=%v", err)
	}
}
