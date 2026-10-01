package postgres

import (
	"context"
	"testing"

	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

// Ledger readers must keep selecting their known columns after the shared
// table gains additional metadata columns. sqlc expands query-source stars.
func TestLedgerReadsAfterAdditiveSchemaChange(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 5000)
	repository := NewRepository(pool)
	ctx := context.Background()
	if _, err := repository.SettleInTransaction(ctx, seed.match, seed.payer, "首次结算", chargesFor(seed, 3000, 1000)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `ALTER TABLE team_fund_transactions ADD COLUMN schema_compatibility_probe TEXT NULL`); err != nil {
		t.Fatal(err)
	}

	t.Run("user ledger", func(t *testing.T) {
		rows, err := repository.ListTransactions(ctx, seed.payer, 0, 10)
		if err != nil {
			t.Fatal(err)
		}
		if len(rows) != 1 || rows[0].AmountCents != -3000 || rows[0].BalanceAfterCents != 2000 {
			t.Fatalf("unexpected ledger: %+v", rows)
		}
	})
	t.Run("settlement summary", func(t *testing.T) {
		summary, err := repository.GetSummary(ctx, seed.match)
		if err != nil {
			t.Fatal(err)
		}
		if !summary.Settled || summary.TotalAmountCents != 4000 || len(summary.Items) != 2 {
			t.Fatalf("unexpected summary: %+v", summary)
		}
	})
	t.Run("reverse and resettle", func(t *testing.T) {
		outcome, err := repository.SettleInTransaction(ctx, seed.match, seed.payer, "重算", chargesFor(seed, 2000, 500))
		if err != nil {
			t.Fatal(err)
		}
		if outcome.ReversedBatchNo != 2 || outcome.BatchNo != 3 || outcome.TotalAmountCents != 2500 {
			t.Fatalf("unexpected resettlement: %+v", outcome)
		}
		if balance := memberBalance(t, pool, seed.teamID, seed.payer); balance != 3000 {
			t.Fatalf("payer balance = %d, want 3000", balance)
		}
		if balance := memberBalance(t, pool, seed.teamID, seed.cold); balance != -500 {
			t.Fatalf("cold balance = %d, want -500", balance)
		}
	})
}
