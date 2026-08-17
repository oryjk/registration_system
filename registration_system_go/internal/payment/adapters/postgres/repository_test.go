package postgres

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	paymentsqlc "github.com/oryjk/registration_system/registration_system_go/internal/payment/adapters/postgres/sqlc"
	paymentdomain "github.com/oryjk/registration_system/registration_system_go/internal/payment/domain"
	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestRepositoryPersistsAndListsRechargeOrder(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedPaymentUser(t, pool, "persist")
	order := mustPaymentOrder(t, uniquePaymentOrderNo("persist"), userID, 1)
	repository := NewRepository(pool)

	if err := repository.Create(ctx, order); err != nil {
		t.Fatal(err)
	}
	prepared, err := repository.SavePrepared(ctx, order.OrderNo, "prepay-1", time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	items, total, err := repository.List(ctx, paymentports.OrderFilter{UserID: userID, Limit: 20})
	if err != nil {
		t.Fatal(err)
	}
	if prepared.PrepayID != "prepay-1" || total != 1 || len(items) != 1 || items[0].OrderNo != order.OrderNo {
		t.Fatalf("prepared=%+v total=%d items=%+v", prepared, total, items)
	}
}

func TestCreditRechargeIsAtomicAndIdempotent(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedPaymentUser(t, pool, "settle")
	order := mustPaymentOrder(t, uniquePaymentOrderNo("settle"), userID, 500)
	repository := NewRepository(pool)
	if err := repository.Create(ctx, order); err != nil {
		t.Fatal(err)
	}
	payment := paymentports.VerifiedPayment{OrderNo: order.OrderNo, AmountCents: 500, TransactionID: "wx-" + order.OrderNo, PaidAt: time.Now().UTC()}

	first, err := repository.CreditRecharge(ctx, payment)
	if err != nil {
		t.Fatal(err)
	}
	second, err := repository.CreditRecharge(ctx, payment)
	if err != nil {
		t.Fatal(err)
	}
	var transactions int64
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM wallet_transactions WHERE source_type='payment_order' AND source_id=$1`, order.OrderNo).Scan(&transactions); err != nil {
		t.Fatal(err)
	}
	if !first.Credited || second.Credited || first.BalanceCents != 500 || second.BalanceCents != 500 || transactions != 1 {
		t.Fatalf("first=%+v second=%+v transactions=%d", first, second, transactions)
	}
}

func TestCreditRechargeRejectsAmountMismatchWithoutCrediting(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedPaymentUser(t, pool, "mismatch")
	order := mustPaymentOrder(t, uniquePaymentOrderNo("mismatch"), userID, 500)
	repository := NewRepository(pool)
	if err := repository.Create(ctx, order); err != nil {
		t.Fatal(err)
	}
	_, err := repository.CreditRecharge(ctx, paymentports.VerifiedPayment{OrderNo: order.OrderNo, AmountCents: 499, TransactionID: "wx-" + order.OrderNo, PaidAt: time.Now().UTC()})
	if !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("CreditRecharge() error=%v", err)
	}
	var accounts int64
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM wallet_accounts WHERE user_id=$1`, userID).Scan(&accounts); err != nil {
		t.Fatal(err)
	}
	if accounts != 0 {
		t.Fatalf("wallet account created after rejected settlement")
	}
}

func TestValidateRechargeTransactionRejectsMismatchedSource(t *testing.T) {
	order := paymentdomain.Order{OrderNo: "P1", UserID: 37, AmountCents: 500}
	transaction := paymentsqlc.WalletTransaction{
		UserID: 37, Direction: "credit", Type: "recharge", AmountCents: 1,
		SourceType: "payment_order", SourceID: "P1",
	}

	if err := validateRechargeTransaction(transaction, order); !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("validateRechargeTransaction() error=%v, want conflict", err)
	}
}

func TestCreditRechargeRejectsConflictingSourceAndRollsBackPaidStatus(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedPaymentUser(t, pool, "source-conflict")
	order := mustPaymentOrder(t, uniquePaymentOrderNo("source-conflict"), userID, 500)
	repository := NewRepository(pool)
	if err := repository.Create(ctx, order); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO wallet_accounts (user_id, balance_cents, total_recharged_cents) VALUES ($1, 1, 1)`, userID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO wallet_transactions (id, user_id, direction, type, amount_cents, balance_after_cents, source_type, source_id) VALUES ($1, $2, 'credit', 'recharge', 1, 1, 'payment_order', $3)`, uuid.New(), userID, order.OrderNo); err != nil {
		t.Fatal(err)
	}

	_, err := repository.CreditRecharge(ctx, paymentports.VerifiedPayment{OrderNo: order.OrderNo, AmountCents: 500, TransactionID: "wx-" + order.OrderNo, PaidAt: time.Now().UTC()})
	if !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("CreditRecharge() error=%v, want conflict", err)
	}
	var status string
	var balance int64
	if err := pool.QueryRow(ctx, `SELECT status FROM payment_orders WHERE order_no=$1`, order.OrderNo).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT balance_cents FROM wallet_accounts WHERE user_id=$1`, userID).Scan(&balance); err != nil {
		t.Fatal(err)
	}
	if status != "pending" || balance != 1 {
		t.Fatalf("status=%q balance=%d", status, balance)
	}
}

func TestCreditRechargeUsesSettlementTimeForWalletTimestamps(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedPaymentUser(t, pool, "settlement-time")
	order := mustPaymentOrder(t, uniquePaymentOrderNo("settlement-time"), userID, 500)
	repository := NewRepository(pool)
	if err := repository.Create(ctx, order); err != nil {
		t.Fatal(err)
	}
	paidAt := time.Now().UTC().Add(-24 * time.Hour)
	beforeSettlement := time.Now().UTC().Add(-time.Second)
	if _, err := repository.CreditRecharge(ctx, paymentports.VerifiedPayment{OrderNo: order.OrderNo, AmountCents: 500, TransactionID: "wx-" + order.OrderNo, PaidAt: paidAt}); err != nil {
		t.Fatal(err)
	}
	var transactionCreatedAt, accountUpdatedAt time.Time
	if err := pool.QueryRow(ctx, `SELECT created_at FROM wallet_transactions WHERE source_type='payment_order' AND source_id=$1`, order.OrderNo).Scan(&transactionCreatedAt); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT updated_at FROM wallet_accounts WHERE user_id=$1`, userID).Scan(&accountUpdatedAt); err != nil {
		t.Fatal(err)
	}
	if transactionCreatedAt.Before(beforeSettlement) || accountUpdatedAt.Before(beforeSettlement) {
		t.Fatalf("paid_at=%s transaction_created_at=%s account_updated_at=%s", paidAt, transactionCreatedAt, accountUpdatedAt)
	}
}

func TestCreditRechargeConcurrentCallsCreditOnce(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedPaymentUser(t, pool, "concurrent")
	order := mustPaymentOrder(t, uniquePaymentOrderNo("concurrent"), userID, 500)
	repository := NewRepository(pool)
	if err := repository.Create(ctx, order); err != nil {
		t.Fatal(err)
	}
	payment := paymentports.VerifiedPayment{OrderNo: order.OrderNo, AmountCents: 500, TransactionID: "wx-" + order.OrderNo, PaidAt: time.Now().UTC()}

	results := make(chan paymentports.SettlementResult, 2)
	errorsCh := make(chan error, 2)
	var wait sync.WaitGroup
	for range 2 {
		wait.Add(1)
		go func() {
			defer wait.Done()
			result, err := repository.CreditRecharge(ctx, payment)
			results <- result
			errorsCh <- err
		}()
	}
	wait.Wait()
	close(results)
	close(errorsCh)
	credited := 0
	for err := range errorsCh {
		if err != nil {
			t.Fatal(err)
		}
	}
	for result := range results {
		if result.Credited {
			credited++
		}
	}
	var balance, transactions int64
	if err := pool.QueryRow(ctx, `SELECT balance_cents FROM wallet_accounts WHERE user_id=$1`, userID).Scan(&balance); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM wallet_transactions WHERE source_type='payment_order' AND source_id=$1`, order.OrderNo).Scan(&transactions); err != nil {
		t.Fatal(err)
	}
	if credited != 1 || balance != 500 || transactions != 1 {
		t.Fatalf("credited=%d balance=%d transactions=%d", credited, balance, transactions)
	}
}

type paymentQueryer interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func seedPaymentUser(t *testing.T, pool paymentQueryer, suffix string) int64 {
	t.Helper()
	var id int64
	openid := fmt.Sprintf("payment-%s-%d", suffix, time.Now().UnixNano())
	if err := pool.QueryRow(context.Background(), `INSERT INTO users (openid) VALUES ($1) RETURNING id`, openid).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func uniquePaymentOrderNo(prefix string) string {
	value := fmt.Sprintf("P%d%s", time.Now().UnixNano(), prefix)
	if len(value) > 32 {
		return value[:32]
	}
	return value
}

func mustPaymentOrder(t *testing.T, orderNo string, userID, amount int64) paymentdomain.Order {
	t.Helper()
	order, err := paymentdomain.NewRechargeOrder(orderNo, userID, amount, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	return order
}

func TestApplyMembershipPaymentCreditsTeamBalanceWithoutTouchingCreditOrVipAndIsIdempotent(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedPaymentUser(t, pool, "member")
	vipUntil := time.Now().UTC().Add(72 * time.Hour).Truncate(time.Microsecond)
	var teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name, credit_score, vip_until) VALUES ('队费球队', 50, $1) RETURNING id`, vipUntil).Scan(&teamID); err != nil {
		t.Fatal(err)
	}
	order, err := paymentdomain.NewTeamMembershipOrder(uniquePaymentOrderNo("teamfee"), userID, teamID, 7500, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	repository := NewRepository(pool)
	if err := repository.Create(ctx, order); err != nil {
		t.Fatal(err)
	}
	payment := paymentports.VerifiedPayment{OrderNo: order.OrderNo, AmountCents: order.AmountCents, TransactionID: "wx-" + order.OrderNo, PaidAt: time.Now().UTC()}
	credit := paymentports.TeamFundCredit{TeamID: teamID, AmountCents: order.AmountCents}

	first, err := repository.ApplyMembershipPayment(ctx, payment, credit)
	if err != nil {
		t.Fatal(err)
	}
	second, err := repository.ApplyMembershipPayment(ctx, payment, credit)
	if err != nil {
		t.Fatal(err)
	}

	var actualVipUntil time.Time
	var creditScore, balance int64
	if err := pool.QueryRow(ctx, `SELECT vip_until, credit_score, balance_cents FROM teams WHERE id=$1`, teamID).Scan(&actualVipUntil, &creditScore, &balance); err != nil {
		t.Fatal(err)
	}
	// 队费只入球队余额；不动信用分、不动 vip_until；幂等重放不叠加。
	if creditScore != 50 {
		t.Fatalf("credit_score changed: %d", creditScore)
	}
	if balance != 7500 || first.BalanceCents != 7500 {
		t.Fatalf("balance=%d result.BalanceCents=%d", balance, first.BalanceCents)
	}
	if !actualVipUntil.Equal(vipUntil) {
		t.Fatalf("vip_until changed: before=%v after=%v", vipUntil, actualVipUntil)
	}
	if !first.Credited || second.Credited {
		t.Fatalf("first=%+v second=%+v", first, second)
	}
	if second.Order.Status != paymentdomain.StatusPaid {
		t.Fatalf("replayed order status=%s", second.Order.Status)
	}
}

func TestApplyMembershipPaymentRejectsAmountMismatch(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedPaymentUser(t, pool, "mismatch")
	var teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('金额不符球队') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatal(err)
	}
	order, err := paymentdomain.NewTeamMembershipOrder(uniquePaymentOrderNo("mism"), userID, teamID, 3000, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	repository := NewRepository(pool)
	if err := repository.Create(ctx, order); err != nil {
		t.Fatal(err)
	}
	payment := paymentports.VerifiedPayment{OrderNo: order.OrderNo, AmountCents: 1, TransactionID: "wx-bad", PaidAt: time.Now().UTC()}
	if _, err := repository.ApplyMembershipPayment(ctx, payment, paymentports.TeamFundCredit{TeamID: teamID}); err == nil {
		t.Fatal("expected amount mismatch conflict")
	}
	loaded, err := repository.Get(ctx, order.OrderNo)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Status != paymentdomain.StatusPending {
		t.Fatalf("order should stay pending, got %s", loaded.Status)
	}
}
