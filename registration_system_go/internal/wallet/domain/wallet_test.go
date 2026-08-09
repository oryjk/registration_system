package domain

import (
	"errors"
	"testing"
	"time"
)

func TestDebitRejectsInsufficientBalanceWithoutMutation(t *testing.T) {
	account := Account{UserID: 37, BalanceCents: 100, TotalRechargedCents: 100}
	_, err := account.Debit(101, "registration", "match-1", "报名扣费", time.Now())
	if !errors.Is(err, ErrInsufficientBalance) {
		t.Fatalf("Debit() error = %v, want insufficient balance", err)
	}
	if account.BalanceCents != 100 || account.TotalSpentCents != 0 {
		t.Fatalf("account mutated after rejected debit: %+v", account)
	}
}

func TestDebitCreatesImmutableBalanceSnapshot(t *testing.T) {
	now := time.Now()
	account := Account{UserID: 37, BalanceCents: 100, TotalRechargedCents: 100}
	transaction, err := account.Debit(40, "registration", "match-1", "报名扣费", now)
	if err != nil {
		t.Fatal(err)
	}
	if account.BalanceCents != 60 || account.TotalSpentCents != 40 || account.Version != 1 {
		t.Fatalf("account = %+v", account)
	}
	if transaction.Direction != DirectionDebit || transaction.Type != TransactionSpend || transaction.BalanceAfterCents != 60 {
		t.Fatalf("transaction = %+v", transaction)
	}
}
