package postgres

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	paymentdomain "github.com/oryjk/registration_system/registration_system_go/internal/payment/domain"
	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestApplyTeamVipPaymentOnceCreditsAndIdempotent(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedPaymentUser(t, pool, "vip-once")
	var teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('单次会员测试队') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC().Truncate(time.Microsecond)
	order, err := paymentdomain.NewTeamVipOrder(uniquePaymentOrderNo("viponce"), userID, teamID, "once", 900, now)
	if err != nil {
		t.Fatal(err)
	}
	repo := NewRepository(pool)
	if err := repo.Create(ctx, order); err != nil {
		t.Fatal(err)
	}

	payment := paymentports.VerifiedPayment{
		OrderNo: order.OrderNo, AmountCents: 900, TransactionID: "wx-" + order.OrderNo, PaidAt: now,
	}

	// 并发两次核销，只应加 1 次权益。
	var wg sync.WaitGroup
	results := make(chan paymentports.SettlementResult, 2)
	errs := make(chan error, 2)
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res, applyErr := repo.ApplyTeamVipPayment(ctx, payment, "once", 0, 1)
			results <- res
			errs <- applyErr
		}()
	}
	wg.Wait()
	close(results)
	close(errs)
	for applyErr := range errs {
		if applyErr != nil {
			t.Fatal(applyErr)
		}
	}
	creditedCount := 0
	for res := range results {
		if res.Credited {
			creditedCount++
		}
	}
	var credits int
	if err := pool.QueryRow(ctx, `SELECT vip_credits FROM teams WHERE id=$1`, teamID).Scan(&credits); err != nil {
		t.Fatal(err)
	}
	if creditedCount != 1 || credits != 1 {
		t.Fatalf("creditedCount=%d credits=%d, want 1/1", creditedCount, credits)
	}
}

func TestApplyTeamVipPaymentMonthlyAndYearlyExtendsActiveVipUntil(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedPaymentUser(t, pool, "vip-duration")
	var teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('周期会员测试队') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatal(err)
	}
	repo := NewRepository(pool)
	paidAt := time.Date(2026, 11, 23, 12, 0, 0, 0, time.UTC)

	// 首次开通月度：从 paidAt 起算 +30 天。
	monthly, err := paymentdomain.NewTeamVipOrder(uniquePaymentOrderNo("vipm"), userID, teamID, "monthly", 1900, paidAt)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.Create(ctx, monthly); err != nil {
		t.Fatal(err)
	}
	first, err := repo.ApplyTeamVipPayment(ctx, paymentports.VerifiedPayment{
		OrderNo: monthly.OrderNo, AmountCents: 1900, TransactionID: "wx-m1", PaidAt: paidAt,
	}, "monthly", 30, 0)
	if err != nil || !first.Credited {
		t.Fatalf("monthly apply: res=%+v err=%v", first, err)
	}
	var vipUntil time.Time
	if err := pool.QueryRow(ctx, `SELECT vip_until FROM teams WHERE id=$1`, teamID).Scan(&vipUntil); err != nil {
		t.Fatal(err)
	}
	wantFirst := paidAt.Add(30 * 24 * time.Hour)
	if !vipUntil.Equal(wantFirst) {
		t.Fatalf("first vip_until=%v, want %v", vipUntil, wantFirst)
	}

	// 有效期内续费年度：在原 vip_until 基础上顺延 +365 天。
	yearlyPaidAt := paidAt.Add(24 * time.Hour)
	yearly, err := paymentdomain.NewTeamVipOrder(uniquePaymentOrderNo("vipy"), userID, teamID, "yearly", 9900, yearlyPaidAt)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.Create(ctx, yearly); err != nil {
		t.Fatal(err)
	}
	second, err := repo.ApplyTeamVipPayment(ctx, paymentports.VerifiedPayment{
		OrderNo: yearly.OrderNo, AmountCents: 9900, TransactionID: "wx-y1", PaidAt: yearlyPaidAt,
	}, "yearly", 365, 0)
	if err != nil || !second.Credited {
		t.Fatalf("yearly apply: res=%+v err=%v", second, err)
	}
	if err := pool.QueryRow(ctx, `SELECT vip_until FROM teams WHERE id=$1`, teamID).Scan(&vipUntil); err != nil {
		t.Fatal(err)
	}
	wantSecond := wantFirst.Add(365 * 24 * time.Hour)
	if !vipUntil.Equal(wantSecond) {
		t.Fatalf("extended vip_until=%v, want %v", vipUntil, wantSecond)
	}

	// 金额不符拒绝核销。
	bad, err := paymentdomain.NewTeamVipOrder(uniquePaymentOrderNo("vipbad"), userID, teamID, "once", 900, paidAt)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.Create(ctx, bad); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.ApplyTeamVipPayment(ctx, paymentports.VerifiedPayment{
		OrderNo: bad.OrderNo, AmountCents: 100, TransactionID: "wx-bad", PaidAt: paidAt,
	}, "once", 0, 1); !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("amount mismatch err=%v, want conflict", err)
	}
}
