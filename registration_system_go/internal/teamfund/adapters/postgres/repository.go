package postgres

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	teamfundsqlc "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/adapters/postgres/sqlc"
	teamfundports "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/ports"
)

type database interface {
	teamfundsqlc.DBTX
	Begin(context.Context) (pgx.Tx, error)
}

type Repository struct {
	database database
	queries  *teamfundsqlc.Queries
}

func NewRepository(database database) *Repository {
	return &Repository{database: database, queries: teamfundsqlc.New(database)}
}

// SettleInTransaction 结算落账（单事务）：
// 1. FOR UPDATE 锁当前生效 settle 批，存在则先插入 reverse 批并逐人回加余额；
// 2. 插入新的 settle 批，逐人扣减 team_members.balance_cents（允许负数=欠款）并写流水；
// 每场至多一个生效批次由部分唯一索引兜底，并发冲突返回 ErrConflict。
func (r *Repository) SettleInTransaction(ctx context.Context, matchID uuid.UUID, createdByUserID int64, description string, charges []teamfundports.SettlementCharge) (teamfundports.SettleOutcome, error) {
	var outcome teamfundports.SettleOutcome
	tx, err := r.database.Begin(ctx)
	if err != nil {
		return outcome, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	queries := r.queries.WithTx(tx)
	matchUUID := pgtype.UUID{Bytes: matchID, Valid: true}

	nextNo, err := queries.GetNextSettlementBatchNo(ctx, matchUUID)
	if err != nil {
		return outcome, err
	}
	active, err := queries.GetActiveSettlementBatchForUpdate(ctx, matchUUID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return outcome, err
	}
	hasActive := !errors.Is(err, pgx.ErrNoRows)

	if hasActive {
		reverseTotal := -active.TotalAmountCents
		reverseID, err := queries.InsertSettlementBatch(ctx, teamfundsqlc.InsertSettlementBatchParams{
			MatchID: matchUUID, BatchNo: nextNo, OperationType: "reverse",
			ReversalOfBatchID: &active.ID, Description: "冲正批次 #" + strconv.FormatInt(int64(active.BatchNo), 10),
			TotalAmountCents: reverseTotal, UserCount: active.UserCount, CreatedByUserID: createdByUserID,
		})
		if err != nil {
			return outcome, mapConstraintError(err)
		}
		oldTransactions, err := queries.ListTeamFundTransactionsBySource(ctx, teamfundsqlc.ListTeamFundTransactionsBySourceParams{
			Source: "match_settlement", SourceID: strconv.FormatInt(active.ID, 10),
		})
		if err != nil {
			return outcome, err
		}
		for _, transaction := range oldTransactions {
			balance, err := queries.CreditTeamMemberFund(ctx, teamfundsqlc.CreditTeamMemberFundParams{
				AmountCents: -transaction.AmountCents, TeamID: transaction.TeamID, UserID: transaction.UserID,
			})
			if err != nil {
				return outcome, err
			}
			if _, err := queries.InsertTeamFundTransaction(ctx, teamfundsqlc.InsertTeamFundTransactionParams{
				TeamID: transaction.TeamID, UserID: transaction.UserID,
				AmountCents: -transaction.AmountCents, BalanceAfterCents: balance,
				Source: "settlement_reversal", SourceID: strconv.FormatInt(reverseID, 10),
				MatchID: transaction.MatchID, Description: "结算冲正回加",
			}); err != nil {
				return outcome, mapConstraintError(err)
			}
		}
		if err := queries.MarkSettlementBatchReversed(ctx, teamfundsqlc.MarkSettlementBatchReversedParams{
			ReversedByBatchID: &reverseID, BatchID: active.ID,
		}); err != nil {
			return outcome, err
		}
		outcome.ReversedBatchNo = nextNo
		nextNo++
	}

	total, chargedCount := settlementTotals(charges)
	settleID, err := queries.InsertSettlementBatch(ctx, teamfundsqlc.InsertSettlementBatchParams{
		MatchID: matchUUID, BatchNo: nextNo, OperationType: "settle",
		Description: description, TotalAmountCents: total, UserCount: chargedCount,
		CreatedByUserID: createdByUserID,
	})
	if err != nil {
		return outcome, mapConstraintError(err)
	}

	items := make([]teamfundports.SettlementItem, 0, len(charges))
	for _, charge := range charges {
		balance, err := r.applyCharge(ctx, queries, matchUUID, settleID, description, charge)
		if err != nil {
			return outcome, err
		}
		items = append(items, teamfundports.SettlementItem{
			TeamID: charge.TeamID, UserID: charge.UserID,
			AmountCents: charge.AmountCents, BalanceAfterCents: balance,
		})
	}
	if err := tx.Commit(ctx); err != nil {
		return outcome, err
	}
	outcome.BatchNo = nextNo
	outcome.Description = description
	outcome.TotalAmountCents = total
	outcome.Items = items
	return outcome, nil
}

// applyCharge 执行单人扣款：金额 0 仅查询余额展示；>0 时建行、加锁、扣减并写流水。
func (r *Repository) applyCharge(ctx context.Context, queries *teamfundsqlc.Queries, matchID pgtype.UUID, settleID int64, description string, charge teamfundports.SettlementCharge) (int64, error) {
	if charge.AmountCents == 0 {
		balance, err := queries.GetTeamMemberFundBalance(ctx, teamfundsqlc.GetTeamMemberFundBalanceParams{
			TeamID: charge.TeamID, UserID: charge.UserID,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil
		}
		return balance, err
	}
	if _, err := queries.EnsureTeamMemberFundRow(ctx, teamfundsqlc.EnsureTeamMemberFundRowParams{
		TeamID: charge.TeamID, UserID: charge.UserID,
	}); err != nil {
		return 0, err
	}
	if _, err := queries.LockTeamMemberFund(ctx, teamfundsqlc.LockTeamMemberFundParams{
		TeamID: charge.TeamID, UserID: charge.UserID,
	}); err != nil {
		return 0, err
	}
	balance, err := queries.DebitTeamMemberFund(ctx, teamfundsqlc.DebitTeamMemberFundParams{
		AmountCents: charge.AmountCents, TeamID: charge.TeamID, UserID: charge.UserID,
	})
	if err != nil {
		return 0, err
	}
	_, err = queries.InsertTeamFundTransaction(ctx, teamfundsqlc.InsertTeamFundTransactionParams{
		TeamID: charge.TeamID, UserID: charge.UserID,
		AmountCents: -charge.AmountCents, BalanceAfterCents: balance,
		Source: "match_settlement", SourceID: strconv.FormatInt(settleID, 10),
		MatchID: matchID, Description: description,
	})
	if err != nil {
		return 0, mapConstraintError(err)
	}
	return balance, nil
}

func settlementTotals(charges []teamfundports.SettlementCharge) (total int64, chargedCount int32) {
	for _, charge := range charges {
		total += charge.AmountCents
		if charge.AmountCents > 0 {
			chargedCount++
		}
	}
	return total, chargedCount
}

// GetSummary 组装结算摘要：生效批次明细 + 全量批次历史；未结算时 items 为空。
func (r *Repository) GetSummary(ctx context.Context, matchID uuid.UUID) (teamfundports.SettlementSummary, error) {
	summary := teamfundports.SettlementSummary{Items: []teamfundports.SettlementItem{}, History: []teamfundports.SettlementBatch{}}
	matchUUID := pgtype.UUID{Bytes: matchID, Valid: true}
	batches, err := r.queries.ListSettlementBatches(ctx, matchUUID)
	if err != nil {
		return summary, err
	}
	for _, batch := range batches {
		summary.History = append(summary.History, teamfundports.SettlementBatch{
			BatchNo: batch.BatchNo, OperationType: batch.OperationType, Description: batch.Description,
			TotalAmountCents: batch.TotalAmountCents, UserCount: batch.UserCount, CreatedAt: batch.CreatedAt.Time,
		})
	}
	for _, batch := range batches {
		if batch.OperationType != "settle" || batch.ReversedByBatchID != nil {
			continue
		}
		transactions, err := r.queries.ListTeamFundTransactionsBySource(ctx, teamfundsqlc.ListTeamFundTransactionsBySourceParams{
			Source: "match_settlement", SourceID: strconv.FormatInt(batch.ID, 10),
		})
		if err != nil {
			return summary, err
		}
		for _, transaction := range transactions {
			summary.Items = append(summary.Items, teamfundports.SettlementItem{
				TeamID: transaction.TeamID, UserID: transaction.UserID,
				AmountCents: -transaction.AmountCents, BalanceAfterCents: transaction.BalanceAfterCents,
			})
		}
		summary.Settled = true
		summary.BatchNo = batch.BatchNo
		summary.Description = batch.Description
		summary.TotalAmountCents = batch.TotalAmountCents
		settledAt := batch.CreatedAt.Time
		summary.SettledAt = &settledAt
		break
	}
	return summary, nil
}

func (r *Repository) ListBalances(ctx context.Context, userID int64) ([]teamfundports.TeamFundBalance, error) {
	rows, err := r.queries.ListTeamFundBalances(ctx, userID)
	if err != nil {
		return nil, err
	}
	balances := make([]teamfundports.TeamFundBalance, 0, len(rows))
	for _, row := range rows {
		balances = append(balances, teamfundports.TeamFundBalance{
			TeamID: row.TeamID, TeamName: row.TeamName, BalanceCents: row.BalanceCents,
		})
	}
	return balances, nil
}

func (r *Repository) ListTransactions(ctx context.Context, userID int64, beforeID int64, limit int) ([]teamfundports.TeamFundTransaction, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	rows, err := r.queries.ListTeamFundTransactionsForUser(ctx, teamfundsqlc.ListTeamFundTransactionsForUserParams{
		UserID: userID, BeforeID: beforeID, LimitRows: int32(limit),
	})
	if err != nil {
		return nil, err
	}
	transactions := make([]teamfundports.TeamFundTransaction, 0, len(rows))
	for _, row := range rows {
		transaction := teamfundports.TeamFundTransaction{
			ID: row.ID, TeamID: row.TeamID, TeamName: row.TeamName,
			AmountCents: row.AmountCents, BalanceAfterCents: row.BalanceAfterCents,
			Source: row.Source, Description: row.Description, CreatedAt: row.CreatedAt.Time,
		}
		if row.MatchID.Valid {
			matchID := uuid.UUID(row.MatchID.Bytes)
			transaction.MatchID = &matchID
		}
		if row.MatchName != nil {
			transaction.MatchName = *row.MatchName
		}
		transactions = append(transactions, transaction)
	}
	return transactions, nil
}

func mapConstraintError(err error) error {
	var postgresError *pgconn.PgError
	if !errors.As(err, &postgresError) {
		return err
	}
	switch postgresError.Code {
	case "23505", "23514":
		return sharederror.ErrConflict
	case "23503":
		// 外键不存在（如 team/user 在成员校验后被并发删除），按校验错误处理而非内部错误。
		return sharederror.Wrap(sharederror.KindValidation, "关联的球队或用户不存在", err)
	}
	return err
}

// AdminCredit 管理员手动充值：校验目标是正式成员（FOR UPDATE 锁定该行）后加钱并记流水（单事务）；
// 非正式成员返回校验错误，不自动建行。
func (r *Repository) AdminCredit(ctx context.Context, credit teamfundports.AdminCredit) (teamfundports.AdminCreditResult, error) {
	if credit.AmountCents <= 0 {
		return teamfundports.AdminCreditResult{}, sharederror.New(sharederror.KindValidation, "充值金额需要大于 0")
	}
	tx, err := r.database.Begin(ctx)
	if err != nil {
		return teamfundports.AdminCreditResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	queries := r.queries.WithTx(tx)
	if _, err := queries.GetActiveTeamMemberForCredit(ctx, teamfundsqlc.GetActiveTeamMemberForCreditParams{
		TeamID: credit.TeamID, UserID: credit.UserID,
	}); errors.Is(err, pgx.ErrNoRows) {
		return teamfundports.AdminCreditResult{}, sharederror.New(sharederror.KindValidation, "该用户不是该球队的正式成员")
	} else if err != nil {
		return teamfundports.AdminCreditResult{}, err
	}
	balance, err := queries.CreditTeamMemberFund(ctx, teamfundsqlc.CreditTeamMemberFundParams{
		AmountCents: credit.AmountCents, TeamID: credit.TeamID, UserID: credit.UserID,
	})
	if err != nil {
		return teamfundports.AdminCreditResult{}, err
	}
	description := strings.TrimSpace(credit.Note)
	if description == "" {
		description = "后台充值"
	}
	transactionID, err := queries.InsertAdminCreditFundTransaction(ctx, teamfundsqlc.InsertAdminCreditFundTransactionParams{
		TeamID: credit.TeamID, UserID: credit.UserID, AmountCents: credit.AmountCents,
		BalanceAfterCents: balance, SourceID: uuid.NewString(), Description: description,
	})
	if err != nil {
		return teamfundports.AdminCreditResult{}, mapConstraintError(err)
	}
	if err := tx.Commit(ctx); err != nil {
		return teamfundports.AdminCreditResult{}, err
	}
	return teamfundports.AdminCreditResult{BalanceCents: balance, TransactionID: transactionID}, nil
}
