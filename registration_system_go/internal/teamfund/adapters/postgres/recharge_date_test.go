package postgres

import (
	"context"
	"errors"
	"testing"
	"time"

	teamfundports "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/ports"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestRechargeStoresReceiptDateAndPreservesEntryTime(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	seed := seedSettlement(t, pool, 0)
	repository := NewRepository(pool)
	ctx := context.Background()
	date := time.Date(2025, 2, 3, 0, 0, 0, 0, time.UTC)
	action := teamfundports.ManualFundAction{TeamID: seed.teamID, UserID: seed.payer, AmountCents: 100, ReceivedOn: &date, IdempotencyKey: "receipt-date"}
	result, err := repository.ManualRecharge(ctx, action)
	if err != nil {
		t.Fatal(err)
	}
	for _, list := range []func() ([]teamfundports.TeamFundTransaction, error){
		func() ([]teamfundports.TeamFundTransaction, error) {
			return repository.ListTransactions(ctx, seed.payer, 0, 10)
		},
		func() ([]teamfundports.TeamFundTransaction, error) {
			return repository.ListMemberTransactions(ctx, seed.teamID, seed.payer, 0, 10)
		},
	} {
		transactions, err := list()
		if err != nil || len(transactions) != 1 {
			t.Fatalf("transactions=%+v err=%v", transactions, err)
		}
		transaction := transactions[0]
		if transaction.ReceivedOn == nil || transaction.ReceivedOn.Format("2006-01-02") != "2025-02-03" {
			t.Fatalf("receipt date lost: %+v", transaction)
		}
		if transaction.CreatedAt.Before(time.Now().Add(-time.Hour)) {
			t.Fatalf("entry time should be now: %v", transaction.CreatedAt)
		}
	}
	replay, err := repository.ManualRecharge(ctx, action)
	if err != nil || !replay.Duplicated || replay.TransactionID != result.TransactionID {
		t.Fatalf("replay=%+v err=%v", replay, err)
	}
	older := time.Date(2025, 1, 3, 0, 0, 0, 0, time.UTC)
	action.ReceivedOn = &older
	if _, err := repository.ManualRecharge(ctx, action); !errors.Is(err, teamfundports.ErrIdempotencyConflict) {
		t.Fatalf("changed receipt date must conflict: %v", err)
	}
	action.IdempotencyKey = "older-receipt"
	if _, err := repository.ManualRecharge(ctx, action); err != nil {
		t.Fatal(err)
	}
	var lastRecharge time.Time
	if err := pool.QueryRow(ctx, `SELECT last_recharge_at FROM team_members WHERE team_id=$1 AND user_id=$2`, seed.teamID, seed.payer).Scan(&lastRecharge); err != nil {
		t.Fatal(err)
	}
	if lastRecharge.UTC().Format(time.RFC3339) != "2025-02-02T16:00:00Z" {
		t.Fatalf("latest receipt should not move backward: %v", lastRecharge)
	}
	if balance := memberBalance(t, pool, seed.teamID, seed.payer); balance != 200 {
		t.Fatalf("expected two credits, got balance %d", balance)
	}
}
