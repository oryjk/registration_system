package ports

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// SettlementCharge 一次结算中单人扣款指令（调用方保证按 (TeamID, UserID) 排序）。
type SettlementCharge struct {
	TeamID      int64
	UserID      int64
	AmountCents int64 // >= 0；0 表示免付
}

// SettlementItem 结算结果行：含扣款后的余额快照。
type SettlementItem struct {
	TeamID            int64
	UserID            int64
	UserName          string
	AmountCents       int64
	BalanceAfterCents int64
}

type SettlementBatch struct {
	BatchNo          int32
	OperationType    string // settle | reverse
	Description      string
	TotalAmountCents int64 // reverse 批为负
	UserCount        int32
	CreatedAt        time.Time
}

type SettleOutcome struct {
	BatchNo          int32
	ReversedBatchNo  int32 // >0 表示发生了冲正重算
	Description      string
	TotalAmountCents int64
	Items            []SettlementItem
}

type TeamFundBalance struct {
	TeamID       int64
	TeamName     string
	BalanceCents int64
}

// AdminCredit 管理员手动充值指令（纯记账，无支付）。
type AdminCredit struct {
	TeamID      int64
	UserID      int64
	AmountCents int64 // > 0
	Note        string
}

type AdminCreditResult struct {
	BalanceCents  int64
	TransactionID int64
}

type TeamFundTransaction struct {
	ID                int64
	TeamID            int64
	TeamName          string
	AmountCents       int64 // 带符号：正=入账，负=扣费
	BalanceAfterCents int64
	Source            string // membership_payment | match_settlement | settlement_reversal | admin_credit
	MatchID           *uuid.UUID
	MatchName         string
	Description       string
	CreatedAt         time.Time
}

type SettlementSummary struct {
	Settled          bool
	BatchNo          int32
	SettledAt        *time.Time
	Description      string
	TotalAmountCents int64
	Items            []SettlementItem
	History          []SettlementBatch
}

type Repository interface {
	// SettleInTransaction 结算落账：若已有生效批次则同事务冲正后重记；余额不足允许扣成负数。
	SettleInTransaction(ctx context.Context, matchID uuid.UUID, createdByUserID int64, description string, charges []SettlementCharge) (SettleOutcome, error)
	GetSummary(ctx context.Context, matchID uuid.UUID) (SettlementSummary, error)
	ListBalances(ctx context.Context, userID int64) ([]TeamFundBalance, error)
	ListTransactions(ctx context.Context, userID int64, beforeID int64, limit int) ([]TeamFundTransaction, error)
	// AdminCredit 管理员手动充值：单事务校验正式成员身份（并锁定成员行）后加钱、记 admin_credit 流水；
	// 非正式成员返回校验错误，不自动建行。
	AdminCredit(ctx context.Context, credit AdminCredit) (AdminCreditResult, error)
}
