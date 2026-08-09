package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	walletsqlc "github.com/oryjk/registration_system/registration_system_go/internal/wallet/adapters/postgres/sqlc"
	walletdomain "github.com/oryjk/registration_system/registration_system_go/internal/wallet/domain"
	walletports "github.com/oryjk/registration_system/registration_system_go/internal/wallet/ports"
)

type database interface {
	walletsqlc.DBTX
	Begin(context.Context) (pgx.Tx, error)
}

type Repository struct {
	database database
	queries  *walletsqlc.Queries
}

func NewRepository(database database) *Repository {
	return &Repository{database: database, queries: walletsqlc.New(database)}
}

func (r *Repository) GetAccount(ctx context.Context, userID int64) (walletdomain.Account, error) {
	row, err := r.queries.GetWalletAccount(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return walletdomain.Account{}, sharederror.ErrNotFound
	}
	if err != nil {
		return walletdomain.Account{}, err
	}
	return mapAccount(row), nil
}

func (r *Repository) ListTransactions(ctx context.Context, filter walletports.TransactionFilter) ([]walletdomain.Transaction, int64, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = 20
	}
	rows, err := r.queries.ListWalletTransactions(ctx, walletsqlc.ListWalletTransactionsParams{UserID: filter.UserID, Limit: int32(limit), Offset: int32(max(filter.Offset, 0))})
	if err != nil {
		return nil, 0, err
	}
	total, err := r.queries.CountWalletTransactions(ctx, filter.UserID)
	if err != nil {
		return nil, 0, err
	}
	items := make([]walletdomain.Transaction, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapTransaction(row))
	}
	return items, total, nil
}

func (r *Repository) Debit(ctx context.Context, request walletports.DebitRequest) (result walletdomain.Account, err error) {
	tx, err := r.database.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	queries := r.queries.WithTx(tx)
	if _, err := queries.EnsureDebitWalletAccount(ctx, request.UserID); err != nil {
		return result, err
	}
	accountRow, err := queries.GetDebitWalletAccountForUpdate(ctx, request.UserID)
	if err != nil {
		return result, err
	}
	existing, err := queries.GetWalletTransactionBySource(ctx, walletsqlc.GetWalletTransactionBySourceParams{SourceType: request.SourceType, SourceID: request.SourceID})
	if err == nil {
		if existing.UserID != request.UserID || existing.Direction != string(walletdomain.DirectionDebit) || existing.AmountCents != request.AmountCents {
			return result, sharederror.ErrConflict
		}
		if err := tx.Commit(ctx); err != nil {
			return result, err
		}
		return mapAccount(accountRow), nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return result, err
	}
	if accountRow.BalanceCents < request.AmountCents {
		return result, walletdomain.ErrInsufficientBalance
	}
	accountRow, err = queries.DebitWalletAccount(ctx, walletsqlc.DebitWalletAccountParams{UserID: request.UserID, BalanceCents: request.AmountCents})
	if errors.Is(err, pgx.ErrNoRows) {
		return result, walletdomain.ErrInsufficientBalance
	}
	if err != nil {
		return result, err
	}
	_, err = queries.InsertDebitWalletTransaction(ctx, walletsqlc.InsertDebitWalletTransactionParams{
		ID: pgtype.UUID{Bytes: uuid.New(), Valid: true}, UserID: request.UserID,
		AmountCents: request.AmountCents, BalanceAfterCents: accountRow.BalanceCents,
		SourceType: request.SourceType, SourceID: request.SourceID, Description: request.Description,
	})
	if err != nil {
		return result, mapConstraintError(err)
	}
	if err := tx.Commit(ctx); err != nil {
		return result, err
	}
	return mapAccount(accountRow), nil
}

func mapAccount(row walletsqlc.WalletAccount) walletdomain.Account {
	return walletdomain.Account{
		UserID: row.UserID, BalanceCents: row.BalanceCents,
		TotalRechargedCents: row.TotalRechargedCents, TotalSpentCents: row.TotalSpentCents,
		Version: row.Version, CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time,
	}
}

func mapTransaction(row walletsqlc.WalletTransaction) walletdomain.Transaction {
	return walletdomain.Transaction{
		ID: uuid.UUID(row.ID.Bytes), UserID: row.UserID,
		Direction: walletdomain.Direction(row.Direction), Type: walletdomain.TransactionType(row.Type),
		AmountCents: row.AmountCents, BalanceAfterCents: row.BalanceAfterCents,
		SourceType: row.SourceType, SourceID: row.SourceID, Description: row.Description,
		CreatedAt: row.CreatedAt.Time,
	}
}

func mapConstraintError(err error) error {
	var postgresError *pgconn.PgError
	if errors.As(err, &postgresError) && (postgresError.Code == "23505" || postgresError.Code == "23514") {
		return sharederror.ErrConflict
	}
	return err
}
