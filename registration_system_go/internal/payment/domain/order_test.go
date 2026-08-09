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
