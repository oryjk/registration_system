package postgres

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	paymentsqlc "github.com/oryjk/registration_system/registration_system_go/internal/payment/adapters/postgres/sqlc"
	paymentdomain "github.com/oryjk/registration_system/registration_system_go/internal/payment/domain"
	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type database interface {
	paymentsqlc.DBTX
	Begin(context.Context) (pgx.Tx, error)
}

type Repository struct {
	database database
	queries  *paymentsqlc.Queries
}

func NewRepository(database database) *Repository {
	return &Repository{database: database, queries: paymentsqlc.New(database)}
}

func (r *Repository) OpenIDForUser(ctx context.Context, userID int64) (string, error) {
	openid, err := r.queries.GetPaymentUserOpenID(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", sharederror.ErrNotFound
	}
	return openid, err
}

func (r *Repository) Create(ctx context.Context, order paymentdomain.Order) error {
	_, err := r.queries.CreatePaymentOrder(ctx, paymentsqlc.CreatePaymentOrderParams{
		OrderNo: order.OrderNo, UserID: order.UserID, AmountCents: order.AmountCents,
		Provider: order.Provider, Channel: order.Channel, Status: string(order.Status),
		Kind: string(order.Kind), TeamID: order.TeamID, Months: monthsToSQL(order.Months),
		CreatedAt: timestamptz(order.CreatedAt),
	})
	return mapConstraintError(err)
}

func (r *Repository) SavePrepared(ctx context.Context, orderNo, prepayID string, now time.Time) (paymentdomain.Order, error) {
	row, err := r.queries.SavePaymentOrderPrepared(ctx, paymentsqlc.SavePaymentOrderPreparedParams{
		OrderNo: orderNo, PrepayID: &prepayID, UpdatedAt: timestamptz(now),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		if _, getErr := r.queries.GetPaymentOrder(ctx, orderNo); errors.Is(getErr, pgx.ErrNoRows) {
			return paymentdomain.Order{}, sharederror.ErrNotFound
		}
		return paymentdomain.Order{}, sharederror.ErrConflict
	}
	if err != nil {
		return paymentdomain.Order{}, err
	}
	return mapOrder(row), nil
}

func (r *Repository) MarkFailed(ctx context.Context, orderNo string, now time.Time) error {
	rows, err := r.queries.MarkPaymentOrderFailed(ctx, paymentsqlc.MarkPaymentOrderFailedParams{OrderNo: orderNo, UpdatedAt: timestamptz(now)})
	if err != nil {
		return err
	}
	if rows == 0 {
		return sharederror.ErrConflict
	}
	return nil
}

func (r *Repository) Get(ctx context.Context, orderNo string) (paymentdomain.Order, error) {
	row, err := r.queries.GetPaymentOrder(ctx, orderNo)
	if errors.Is(err, pgx.ErrNoRows) {
		return paymentdomain.Order{}, sharederror.ErrNotFound
	}
	if err != nil {
		return paymentdomain.Order{}, err
	}
	return mapOrder(row), nil
}

func (r *Repository) List(ctx context.Context, filter paymentports.OrderFilter) ([]paymentdomain.Order, int64, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = 20
	}
	params := paymentsqlc.ListPaymentOrdersParams{
		UserID: filter.UserID, Status: string(filter.Status), Search: strings.TrimSpace(filter.Search),
		ResultLimit: int32(limit), ResultOffset: int32(max(filter.Offset, 0)),
	}
	rows, err := r.queries.ListPaymentOrders(ctx, params)
	if err != nil {
		return nil, 0, err
	}
	total, err := r.queries.CountPaymentOrders(ctx, paymentsqlc.CountPaymentOrdersParams{UserID: params.UserID, Status: params.Status, Search: params.Search})
	if err != nil {
		return nil, 0, err
	}
	items := make([]paymentdomain.Order, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapOrder(row))
	}
	return items, total, nil
}

func (r *Repository) Cancel(ctx context.Context, orderNo string, now time.Time) (paymentdomain.Order, error) {
	row, err := r.queries.CancelPaymentOrder(ctx, paymentsqlc.CancelPaymentOrderParams{OrderNo: orderNo, CancelledAt: timestamptz(now)})
	if errors.Is(err, pgx.ErrNoRows) {
		return paymentdomain.Order{}, sharederror.ErrConflict
	}
	if err != nil {
		return paymentdomain.Order{}, err
	}
	return mapOrder(row), nil
}

func (r *Repository) CreditRecharge(ctx context.Context, payment paymentports.VerifiedPayment) (result paymentports.SettlementResult, err error) {
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
	if order.AmountCents != payment.AmountCents {
		return result, sharederror.New(sharederror.KindConflict, "支付金额不一致")
	}
	if order.Status == paymentdomain.StatusPaid {
		if order.TransactionID != payment.TransactionID {
			return result, sharederror.ErrConflict
		}
		transaction, transactionErr := queries.GetRechargeWalletTransactionBySource(ctx, order.OrderNo)
		if transactionErr != nil {
			if errors.Is(transactionErr, pgx.ErrNoRows) {
				return result, sharederror.ErrConflict
			}
			return result, transactionErr
		}
		if err := validateRechargeTransaction(transaction, order); err != nil {
			return result, err
		}
		account, accountErr := queries.GetRechargeWalletAccountForUpdate(ctx, order.UserID)
		if accountErr != nil {
			return result, accountErr
		}
		if err := tx.Commit(ctx); err != nil {
			return result, err
		}
		return paymentports.SettlementResult{Order: order, BalanceCents: account.BalanceCents}, nil
	}
	if order.Status != paymentdomain.StatusPending {
		return result, sharederror.ErrConflict
	}
	paidRow, err := queries.MarkPaymentOrderPaid(ctx, paymentsqlc.MarkPaymentOrderPaidParams{
		OrderNo: order.OrderNo, TransactionID: &payment.TransactionID, PaidAt: timestamptz(payment.PaidAt),
	})
	if err != nil {
		return result, mapConstraintError(err)
	}
	if _, err := queries.EnsureRechargeWalletAccount(ctx, order.UserID); err != nil {
		return result, err
	}
	account, err := queries.GetRechargeWalletAccountForUpdate(ctx, order.UserID)
	if err != nil {
		return result, err
	}
	_, err = queries.InsertRechargeWalletTransaction(ctx, paymentsqlc.InsertRechargeWalletTransactionParams{
		ID: pgUUID(uuid.New()), UserID: order.UserID, AmountCents: order.AmountCents,
		BalanceAfterCents: account.BalanceCents + order.AmountCents, SourceID: order.OrderNo,
		Description: "微信充值",
	})
	if errors.Is(err, pgx.ErrNoRows) {
		transaction, transactionErr := queries.GetRechargeWalletTransactionBySource(ctx, order.OrderNo)
		if transactionErr != nil {
			if errors.Is(transactionErr, pgx.ErrNoRows) {
				return result, sharederror.ErrConflict
			}
			return result, transactionErr
		}
		if err := validateRechargeTransaction(transaction, order); err != nil {
			return result, err
		}
		if err := tx.Commit(ctx); err != nil {
			return result, err
		}
		return paymentports.SettlementResult{Order: mapOrder(paidRow), BalanceCents: account.BalanceCents}, nil
	}
	if err != nil {
		return result, mapConstraintError(err)
	}
	account, err = queries.CreditRechargeWallet(ctx, paymentsqlc.CreditRechargeWalletParams{
		UserID: order.UserID, BalanceCents: order.AmountCents,
	})
	if err != nil {
		return result, err
	}
	if err := tx.Commit(ctx); err != nil {
		return result, err
	}
	return paymentports.SettlementResult{Order: mapOrder(paidRow), BalanceCents: account.BalanceCents, Credited: true}, nil
}

func validateRechargeTransaction(transaction paymentsqlc.WalletTransaction, order paymentdomain.Order) error {
	if transaction.UserID != order.UserID || transaction.Direction != "credit" || transaction.Type != "recharge" || transaction.AmountCents != order.AmountCents || transaction.SourceType != "payment_order" || transaction.SourceID != order.OrderNo {
		return sharederror.ErrConflict
	}
	return nil
}

func mapOrder(row paymentsqlc.PaymentOrder) paymentdomain.Order {
	order := paymentdomain.Order{
		OrderNo: row.OrderNo, UserID: row.UserID, AmountCents: row.AmountCents,
		Provider: row.Provider, Channel: row.Channel, Status: paymentdomain.Status(row.Status),
		Kind:   paymentdomain.Kind(row.Kind),
		TeamID: row.TeamID, Months: monthsFromSQL(row.Months),
		CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time,
	}
	if row.PrepayID != nil {
		order.PrepayID = *row.PrepayID
	}
	if row.TransactionID != nil {
		order.TransactionID = *row.TransactionID
	}
	if row.PaidAt.Valid {
		paidAt := row.PaidAt.Time
		order.PaidAt = &paidAt
	}
	if row.CancelledAt.Valid {
		cancelledAt := row.CancelledAt.Time
		order.CancelledAt = &cancelledAt
	}
	return order
}

func timestamptz(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value, Valid: true}
}

func pgUUID(value uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: value, Valid: true}
}

func mapConstraintError(err error) error {
	var postgresError *pgconn.PgError
	if errors.As(err, &postgresError) && (postgresError.Code == "23505" || postgresError.Code == "23514") {
		return sharederror.ErrConflict
	}
	return err
}

func monthsToSQL(months *int) *int32 {
	if months == nil {
		return nil
	}
	value := int32(*months)
	return &value
}

func monthsFromSQL(months *int32) *int {
	if months == nil {
		return nil
	}
	value := int(*months)
	return &value
}

// ApplyMembershipPayment 结算一笔队费订单：订单置为已付，金额计入付款人在该球队的个人账户余额。
// 幂等与充值结算同构——重复回调返回已付订单，不重复入账。
func (r *Repository) ApplyMembershipPayment(ctx context.Context, payment paymentports.VerifiedPayment, credit paymentports.TeamFundCredit) (result paymentports.SettlementResult, err error) {
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
	if order.Kind != paymentdomain.KindTeamMembership {
		return result, sharederror.New(sharederror.KindConflict, "该订单不是队费订单")
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
		return paymentports.SettlementResult{Order: order}, nil
	}
	if order.Status != paymentdomain.StatusPending {
		return result, sharederror.ErrConflict
	}
	paidRow, err := queries.MarkPaymentOrderPaid(ctx, paymentsqlc.MarkPaymentOrderPaidParams{
		OrderNo: order.OrderNo, TransactionID: &payment.TransactionID, PaidAt: timestamptz(payment.PaidAt),
	})
	if err != nil {
		return result, mapConstraintError(err)
	}
	balanceCents, err := queries.CreditTeamMemberFundBalance(ctx, paymentsqlc.CreditTeamMemberFundBalanceParams{
		AmountCents: credit.AmountCents, TeamID: credit.TeamID, UserID: credit.UserID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return result, sharederror.New(sharederror.KindNotFound, "队费订单归属的球队成员不存在")
		}
		return result, err
	}
	if err := tx.Commit(ctx); err != nil {
		return result, err
	}
	return paymentports.SettlementResult{Order: mapOrder(paidRow), BalanceCents: balanceCents, Credited: true}, nil
}
