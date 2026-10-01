package ports

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
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

var (
	// ErrIdempotencyConflict 同一幂等键被不同参数重复使用：不能静默成功，必须显式拒绝。
	ErrIdempotencyConflict = errors.New("idempotency key conflict")
)

// TeamManagerAuthorizer 校验操作者是该球队 active 的队长/领队（小程序侧记账权限）。
type TeamManagerAuthorizer interface {
	AuthorizeTeamManager(ctx context.Context, actor sharedauth.Actor, teamID int64) error
}

// ManualFundAction 手动余额动作载荷：充值、消费扣费、冲正共用。
type ManualFundAction struct {
	TeamID      int64
	UserID      int64
	AmountCents int64 // > 0；冲正时为原流水金额的绝对值（由仓储从原流水推导）
	Note        string
	ReceivedOn  *time.Time // 可选实际收款日期（仅充值），与流水录入时间分开保存。
	// 操作人取自后端认证身份，不信任前端传值：普通用户写 OperatorUserID，
	// 后台管理员写 OperatorAdminID；<=0 表示该身份不落库（列记 NULL）。
	OperatorUserID        int64
	OperatorAdminID       int64
	IdempotencyKey        string // 流水 source_id；为空时仓储生成随机 UUID
	OriginalTransactionID int64  // 仅冲正：被冲正的原流水
}

// ManualFundResult 手动动作结果；Duplicated 表示幂等命中（同键同参数重放，未重复记账）。
type ManualFundResult struct {
	BalanceCents  int64
	TransactionID int64
	Duplicated    bool
}

type TeamFundTransaction struct {
	ID                int64
	TeamID            int64
	TeamName          string
	AmountCents       int64 // 带符号：正=入账，负=扣费
	BalanceAfterCents int64
	Source            string // membership_payment | match_settlement | settlement_reversal | admin_credit | manual_consume | manual_reversal | manual_adjustment(历史)
	MatchID           *uuid.UUID
	MatchName         string
	Description       string
	// CreatedByUserID / CreatedByAdminID 操作人：普通用户与后台管理员各记各的列，
	// 历史流水两者均可为空；ReversedByTransactionID 非空表示已被冲正。
	CreatedByUserID         *int64
	CreatedByAdminID        *int64
	ReversedByTransactionID *int64
	CreatedAt               time.Time
	ReceivedOn              *time.Time
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
	// ListMemberTransactions 管理员/队长查看指定成员的队费流水（冲正需定位原流水）。
	ListMemberTransactions(ctx context.Context, teamID, userID, beforeID int64, limit int) ([]TeamFundTransaction, error)
	// ManualRecharge 人工充值（登记实际收到的线下款项）：校验 active 正式成员并锁行后入账，
	// 标记付费会员并刷新最近充值时间；幂等键去重。
	ManualRecharge(ctx context.Context, action ManualFundAction) (ManualFundResult, error)
	// ManualConsume 人工消费扣费：active 正式成员扣减余额（允许扣成负数即欠款），
	// 不触碰付费会员标记与最近充值时间；幂等键去重。
	ManualConsume(ctx context.Context, action ManualFundAction) (ManualFundResult, error)
	// ManualReverse 冲正人工流水（admin_credit/manual_consume/manual_adjustment）：
	// 反向金额回加余额并回写原流水的冲正引用；原流水与目标成员必须匹配且未被冲正。
	ManualReverse(ctx context.Context, action ManualFundAction) (ManualFundResult, error)
}
