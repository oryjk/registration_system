package postgres

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
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
