package postgres

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

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
			// 结算冲正是资金回加而非充值：不得触发付费会员标记与最近充值时间。
			balance, err := queries.AddTeamMemberFundBalance(ctx, teamfundsqlc.AddTeamMemberFundBalanceParams{
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
	rows, err := r.queries.ListTeamFundTransactionsForUser(ctx, teamfundsqlc.ListTeamFundTransactionsForUserParams{
		UserID: userID, BeforeID: beforeID, LimitRows: transactionLimit(limit),
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
			CreatedByUserID: row.CreatedByUserID, CreatedByAdminID: row.CreatedByAdminID, ReversedByTransactionID: row.ReversedByTransactionID,
		}
		if row.ReceivedOn.Valid {
			receivedOn := row.ReceivedOn.Time
			transaction.ReceivedOn = &receivedOn
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

func (r *Repository) ListMemberTransactions(ctx context.Context, teamID, userID, beforeID int64, limit int) ([]teamfundports.TeamFundTransaction, error) {
	rows, err := r.queries.ListTeamFundTransactionsForMember(ctx, teamfundsqlc.ListTeamFundTransactionsForMemberParams{
		TeamID: teamID, UserID: userID, BeforeID: beforeID, LimitRows: transactionLimit(limit),
	})
	if err != nil {
		return nil, err
	}
	transactions := make([]teamfundports.TeamFundTransaction, 0, len(rows))
	for _, row := range rows {
		// member 视角不回填 team_name：球队由请求路径给出。
		transaction := teamfundports.TeamFundTransaction{
			ID: row.ID, TeamID: row.TeamID,
			AmountCents: row.AmountCents, BalanceAfterCents: row.BalanceAfterCents,
			Source: row.Source, Description: row.Description, CreatedAt: row.CreatedAt.Time,
			CreatedByUserID: row.CreatedByUserID, CreatedByAdminID: row.CreatedByAdminID, ReversedByTransactionID: row.ReversedByTransactionID,
		}
		if row.ReceivedOn.Valid {
			receivedOn := row.ReceivedOn.Time
			transaction.ReceivedOn = &receivedOn
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

func transactionLimit(limit int) int32 {
	if limit <= 0 || limit > 100 {
		return 30
	}
	return int32(limit)
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

// ManualRecharge 人工充值：单事务内校验 active 正式成员（锁行）→ 入账（标记付费会员、
// 刷新最近充值时间）→ 记 admin_credit 流水（含操作人）；幂等键同参数重放不重复记账。
func (r *Repository) ManualRecharge(ctx context.Context, action teamfundports.ManualFundAction) (teamfundports.ManualFundResult, error) {
	return r.applyManualAction(ctx, action, "admin_credit", true)
}

// ManualConsume 人工消费扣费：单事务内校验 active 正式成员（锁行）→ 扣减余额（允许负数）
// → 记 manual_consume 流水；不触碰付费会员标记与最近充值时间。
func (r *Repository) ManualConsume(ctx context.Context, action teamfundports.ManualFundAction) (teamfundports.ManualFundResult, error) {
	return r.applyManualAction(ctx, action, "manual_consume", false)
}

// applyManualAction 充值/消费共用的单事务骨架：幂等预检（含球队）→ 成员校验锁行 → 余额变动 → 流水。
// recharge=true 走充值语义（CreditTeamMemberFund 带付费会员/充值时间副作用），否则走普通扣减。
func (r *Repository) applyManualAction(ctx context.Context, action teamfundports.ManualFundAction, source string, recharge bool) (teamfundports.ManualFundResult, error) {
	if action.AmountCents <= 0 {
		return teamfundports.ManualFundResult{}, sharederror.New(sharederror.KindValidation, "金额需要大于 0")
	}
	key := action.IdempotencyKey
	if key == "" {
		key = uuid.NewString()
	}
	expectedAmount := action.AmountCents
	if !recharge {
		expectedAmount = -action.AmountCents
	}
	tx, err := r.database.Begin(ctx)
	if err != nil {
		return teamfundports.ManualFundResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	queries := r.queries.WithTx(tx)

	if replay, found, replayErr := findReplay(ctx, queries, source, key, action.TeamID, action.UserID, expectedAmount, action.ReceivedOn); replayErr != nil {
		return teamfundports.ManualFundResult{}, replayErr
	} else if found {
		return replay, nil
	}
	if _, err := queries.GetActiveTeamMemberForCredit(ctx, teamfundsqlc.GetActiveTeamMemberForCreditParams{
		TeamID: action.TeamID, UserID: action.UserID,
	}); errors.Is(err, pgx.ErrNoRows) {
		return teamfundports.ManualFundResult{}, sharederror.New(sharederror.KindValidation, "该用户不是该球队的正式成员")
	} else if err != nil {
		return teamfundports.ManualFundResult{}, err
	}

	var balance int64
	if recharge {
		balance, err = queries.CreditTeamMemberFund(ctx, teamfundsqlc.CreditTeamMemberFundParams{
			AmountCents: action.AmountCents, TeamID: action.TeamID, UserID: action.UserID,
			ReceivedOn: receiptDate(action.ReceivedOn),
		})
	} else {
		balance, err = queries.DebitTeamMemberFund(ctx, teamfundsqlc.DebitTeamMemberFundParams{
			AmountCents: action.AmountCents, TeamID: action.TeamID, UserID: action.UserID,
		})
	}
	if err != nil {
		return teamfundports.ManualFundResult{}, err
	}
	transactionID, err := queries.InsertManualFundTransaction(ctx, teamfundsqlc.InsertManualFundTransactionParams{
		TeamID: action.TeamID, UserID: action.UserID, AmountCents: expectedAmount,
		BalanceAfterCents: balance, Source: source, SourceID: key,
		Description:     manualDescription(source, action.Note),
		CreatedByUserID: operatorRef(action.OperatorUserID), CreatedByAdminID: operatorRef(action.OperatorAdminID),
	})
	if err != nil {
		if isUniqueViolation(err) {
			// 并发同键已由先到请求落库：本事务因唯一约束冲突已中止，必须先回滚，
			// 再用池级连接复查，按幂等重放或键冲突收敛（在已中止事务里继续查询会得到 25P02）。
			_ = tx.Rollback(ctx)
			return r.resolveReplay(ctx, source, key, action.TeamID, action.UserID, expectedAmount, action.ReceivedOn)
		}
		return teamfundports.ManualFundResult{}, mapConstraintError(err)
	}
	if recharge && action.ReceivedOn != nil {
		if err := queries.InsertTeamFundCreditReceipt(ctx, teamfundsqlc.InsertTeamFundCreditReceiptParams{
			TransactionID: transactionID, ReceivedOn: receiptDate(action.ReceivedOn),
		}); err != nil {
			return teamfundports.ManualFundResult{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return teamfundports.ManualFundResult{}, err
	}
	return teamfundports.ManualFundResult{BalanceCents: balance, TransactionID: transactionID}, nil
}

// ManualReverse 冲正人工流水：锁原流水行（防并发双冲正）→ 反向金额回加余额（无充值副作用）
// → 记 manual_reversal 流水并回写原流水的冲正引用。
func (r *Repository) ManualReverse(ctx context.Context, action teamfundports.ManualFundAction) (teamfundports.ManualFundResult, error) {
	if action.OriginalTransactionID <= 0 {
		return teamfundports.ManualFundResult{}, sharederror.New(sharederror.KindValidation, "原流水无效")
	}
	key := action.IdempotencyKey
	if key == "" {
		key = uuid.NewString()
	}
	tx, err := r.database.Begin(ctx)
	if err != nil {
		return teamfundports.ManualFundResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	queries := r.queries.WithTx(tx)

	// 冲正幂等按「同键 + 同原流水」判定：金额由原流水推导，不随请求携带。
	if replay, found, replayErr := findReversalReplay(ctx, queries, key, action.TeamID, action.UserID, action.OriginalTransactionID); replayErr != nil {
		return teamfundports.ManualFundResult{}, replayErr
	} else if found {
		return replay, nil
	}
	original, err := queries.GetTeamFundTransactionForUpdate(ctx, action.OriginalTransactionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return teamfundports.ManualFundResult{}, sharederror.New(sharederror.KindNotFound, "原流水不存在")
	}
	if err != nil {
		return teamfundports.ManualFundResult{}, err
	}
	if original.ReversedByTransactionID != nil {
		// 并发同键：两个请求都通过预检后在此争锁，先到者已提交冲正。
		// 先按本键复查是否为同键重放（幂等成功），再拒绝不同键的重复冲正。
		if replay, found, replayErr := findReversalReplay(ctx, queries, key, action.TeamID, action.UserID, action.OriginalTransactionID); replayErr != nil {
			return teamfundports.ManualFundResult{}, replayErr
		} else if found {
			return replay, nil
		}
		return teamfundports.ManualFundResult{}, sharederror.New(sharederror.KindConflict, "该流水已冲正，不能重复冲正")
	}
	if original.Source != "admin_credit" && original.Source != "manual_consume" && original.Source != "manual_adjustment" {
		return teamfundports.ManualFundResult{}, sharederror.New(sharederror.KindValidation, "该流水不支持人工冲正（微信支付与比赛结算请走各自的重算流程）")
	}
	if original.TeamID != action.TeamID || original.UserID != action.UserID {
		return teamfundports.ManualFundResult{}, sharederror.New(sharederror.KindValidation, "原流水与目标成员不匹配")
	}

	addBack := -original.AmountCents
	balance, err := queries.AddTeamMemberFundBalance(ctx, teamfundsqlc.AddTeamMemberFundBalanceParams{
		AmountCents: addBack, TeamID: action.TeamID, UserID: action.UserID,
	})
	if err != nil {
		return teamfundports.ManualFundResult{}, err
	}
	transactionID, err := queries.InsertManualFundTransaction(ctx, teamfundsqlc.InsertManualFundTransactionParams{
		TeamID: action.TeamID, UserID: action.UserID, AmountCents: addBack,
		BalanceAfterCents: balance, Source: "manual_reversal", SourceID: key,
		Description:     manualDescription("manual_reversal", action.Note),
		CreatedByUserID: operatorRef(action.OperatorUserID), CreatedByAdminID: operatorRef(action.OperatorAdminID),
	})
	if err != nil {
		if isUniqueViolation(err) {
			_ = tx.Rollback(ctx)
			return r.resolveReversalReplay(ctx, key, action.TeamID, action.UserID, action.OriginalTransactionID)
		}
		return teamfundports.ManualFundResult{}, mapConstraintError(err)
	}
	if err := queries.MarkTeamFundTransactionReversed(ctx, teamfundsqlc.MarkTeamFundTransactionReversedParams{
		ReversalID: &transactionID, ID: original.ID,
	}); err != nil {
		return teamfundports.ManualFundResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return teamfundports.ManualFundResult{}, err
	}
	return teamfundports.ManualFundResult{BalanceCents: balance, TransactionID: transactionID}, nil
}

// findReplay 幂等预检：同 source+key+用户+球队+金额 → 重放成功；同键但球队或金额不同 → 显式冲突。
func findReplay(ctx context.Context, queries *teamfundsqlc.Queries, source, key string, teamID, userID, expectedAmount int64, receivedOn *time.Time) (teamfundports.ManualFundResult, bool, error) {
	rows, err := queries.ListTeamFundTransactionsBySource(ctx, teamfundsqlc.ListTeamFundTransactionsBySourceParams{
		Source: source, SourceID: key,
	})
	if err != nil {
		return teamfundports.ManualFundResult{}, false, err
	}
	for _, row := range rows {
		if row.UserID != userID {
			continue
		}
		if row.TeamID != teamID || row.AmountCents != expectedAmount {
			return teamfundports.ManualFundResult{}, false, teamfundports.ErrIdempotencyConflict
		}
		if receivedOn != nil {
			date, err := queries.GetTeamFundCreditReceiptDate(ctx, row.ID)
			if errors.Is(err, pgx.ErrNoRows) || (err == nil && (!date.Valid || date.Time.Format("2006-01-02") != receivedOn.Format("2006-01-02"))) {
				return teamfundports.ManualFundResult{}, false, teamfundports.ErrIdempotencyConflict
			}
			if err != nil {
				return teamfundports.ManualFundResult{}, false, err
			}
		}
		return teamfundports.ManualFundResult{BalanceCents: row.BalanceAfterCents, TransactionID: row.ID, Duplicated: true}, true, nil
	}
	return teamfundports.ManualFundResult{}, false, nil
}

// findReversalReplay 冲正幂等预检：按键查已落库的冲正流水及其关联原流水，同键同原流水才重放。
func findReversalReplay(ctx context.Context, queries *teamfundsqlc.Queries, key string, teamID, userID, originalTransactionID int64) (teamfundports.ManualFundResult, bool, error) {
	row, err := queries.GetManualReversalOriginalByKey(ctx, teamfundsqlc.GetManualReversalOriginalByKeyParams{
		SourceID: key, UserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return teamfundports.ManualFundResult{}, false, nil
	}
	if err != nil {
		return teamfundports.ManualFundResult{}, false, err
	}
	if row.TeamID != teamID || row.OriginalID != originalTransactionID {
		return teamfundports.ManualFundResult{}, false, teamfundports.ErrIdempotencyConflict
	}
	return teamfundports.ManualFundResult{
		BalanceCents: row.BalanceAfterCents, TransactionID: row.ReversalID, Duplicated: true,
	}, true, nil
}

// resolveReplay 并发冲突后的池级复查：与 findReplay 同规则；理论上必命中（约束保证同键同行），兜底返回键冲突。
func (r *Repository) resolveReplay(ctx context.Context, source, key string, teamID, userID, expectedAmount int64, receivedOn *time.Time) (teamfundports.ManualFundResult, error) {
	if replay, found, err := findReplay(ctx, r.queries, source, key, teamID, userID, expectedAmount, receivedOn); err != nil {
		return teamfundports.ManualFundResult{}, err
	} else if found {
		return replay, nil
	}
	return teamfundports.ManualFundResult{}, teamfundports.ErrIdempotencyConflict
}

func (r *Repository) resolveReversalReplay(ctx context.Context, key string, teamID, userID, originalTransactionID int64) (teamfundports.ManualFundResult, error) {
	if replay, found, err := findReversalReplay(ctx, r.queries, key, teamID, userID, originalTransactionID); err != nil {
		return teamfundports.ManualFundResult{}, err
	} else if found {
		return replay, nil
	}
	return teamfundports.ManualFundResult{}, teamfundports.ErrIdempotencyConflict
}

// operatorRef 操作人外键引用（users / admin_users 各自的列共用此规则）：身份不适用或未知（<=0）记 NULL。
func operatorRef(operatorUserID int64) *int64 {
	if operatorUserID <= 0 {
		return nil
	}
	return &operatorUserID
}

func isUniqueViolation(err error) bool {
	var postgresError *pgconn.PgError
	return errors.As(err, &postgresError) && postgresError.Code == "23505"
}

func manualDescription(source, note string) string {
	note = strings.TrimSpace(note)
	switch source {
	case "admin_credit":
		if note == "" {
			return "人工充值"
		}
		return "人工充值：" + note
	case "manual_consume":
		return "消费扣费：" + note
	case "manual_reversal":
		return "冲正：" + note
	default:
		return note
	}
}
