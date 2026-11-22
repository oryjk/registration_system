package postgres

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	paymentsqlc "github.com/oryjk/registration_system/registration_system_go/internal/payment/adapters/postgres/sqlc"
	paymentdomain "github.com/oryjk/registration_system/registration_system_go/internal/payment/domain"
	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// ApplyTeamVipPayment 幂等核销球队会员订单：单事务内 FOR UPDATE 锁订单防并发重放，
// 已 paid 时返回 Credited=false；否则标记 paid 并按套餐增加 teams.vip_credits 或顺延 teams.vip_until。
func (r *Repository) ApplyTeamVipPayment(ctx context.Context, payment paymentports.VerifiedPayment, plan string, durationDays int, credits int) (result paymentports.SettlementResult, err error) {
	tx, err := r.database.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	queries := r.queries.WithTx(tx)
	row, err := queries.GetPaymentOrderForUpdate(ctx, payment.OrderNo)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, sharederror.ErrNotFound
	}
	if err != nil {
		return result, err
	}
	order := mapOrder(row)
	if order.Kind != paymentdomain.KindTeamVip {
		return result, sharederror.New(sharederror.KindConflict, "该订单不是球队会员订单")
	}
	if order.TeamID == nil || order.VipPlan == nil || strings.TrimSpace(*order.VipPlan) == "" {
		return result, sharederror.New(sharederror.KindConflict, "球队会员订单缺少球队或套餐信息")
	}
	if plan != "" && *order.VipPlan != plan {
		return result, sharederror.New(sharederror.KindConflict, "球队会员套餐不一致")
	}
	if order.AmountCents != payment.AmountCents {
		return result, sharederror.New(sharederror.KindConflict, "支付金额不一致")
	}
	if order.Status == paymentdomain.StatusPaid {
		if order.TransactionID != payment.TransactionID {
			return result, sharederror.ErrConflict
		}
		if err := tx.Commit(ctx); err != nil {
			return result, err
		}
		return paymentports.SettlementResult{Order: order, Credited: false}, nil
	}
	if order.Status != paymentdomain.StatusPending {
		return result, sharederror.ErrConflict
	}
	if durationDays < 0 || credits < 0 || (durationDays == 0 && credits == 0) {
		return result, sharederror.New(sharederror.KindValidation, "球队会员套餐权益无效")
	}

	paidAt := payment.PaidAt
	if paidAt.IsZero() {
		paidAt = time.Now().UTC()
	}
	paidRow, err := queries.MarkPaymentOrderPaid(ctx, paymentsqlc.MarkPaymentOrderPaidParams{
		OrderNo: order.OrderNo, TransactionID: &payment.TransactionID, PaidAt: timestamptz(paidAt),
	})
	if err != nil {
		return result, mapConstraintError(err)
	}

	if credits > 0 {
		tag, execErr := tx.Exec(ctx,
			`UPDATE teams SET vip_credits = vip_credits + $2, updated_at = NOW() WHERE id = $1`,
			*order.TeamID, credits,
		)
		if execErr != nil {
			return result, mapConstraintError(execErr)
		}
		if tag.RowsAffected() == 0 {
			return result, sharederror.New(sharederror.KindNotFound, "球队会员订单归属的球队不存在")
		}
	}
	if durationDays > 0 {
		tag, execErr := tx.Exec(ctx,
			`UPDATE teams
			 SET vip_until = GREATEST(COALESCE(vip_until, $2::timestamptz), $2::timestamptz) + make_interval(days => $3::int),
			     updated_at = NOW()
			 WHERE id = $1`,
			*order.TeamID, paidAt.UTC(), durationDays,
		)
		if execErr != nil {
			return result, mapConstraintError(execErr)
		}
		if tag.RowsAffected() == 0 {
			return result, sharederror.New(sharederror.KindNotFound, "球队会员订单归属的球队不存在")
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return result, err
	}
	return paymentports.SettlementResult{Order: mapOrder(paidRow), Credited: true}, nil
}
