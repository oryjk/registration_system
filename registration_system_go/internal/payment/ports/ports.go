package ports

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	paymentdomain "github.com/oryjk/registration_system/registration_system_go/internal/payment/domain"
)

var (
	ErrProviderRejected    = errors.New("payment provider rejected request")
	ErrProviderUnavailable = errors.New("payment provider unavailable")
)

type OrderFilter struct {
	UserID int64
	Status paymentdomain.Status
	Search string
	Limit  int
	Offset int
}

type OrderRepository interface {
	Create(context.Context, paymentdomain.Order) error
	SavePrepared(context.Context, string, string, time.Time) (paymentdomain.Order, error)
	MarkFailed(context.Context, string, time.Time) error
	Get(context.Context, string) (paymentdomain.Order, error)
	List(context.Context, OrderFilter) ([]paymentdomain.Order, int64, error)
	Cancel(context.Context, string, time.Time) (paymentdomain.Order, error)
	// CancelPendingForMatch 关闭同一比赛同一用户全部未支付的报名费订单；
	// 调整报名人数后重新下单前调用，避免旧金额订单被误付。
	CancelPendingForMatch(context.Context, uuid.UUID, int64, time.Time) error
}

type UserOpenIDReader interface {
	OpenIDForUser(context.Context, int64) (string, error)
}

type UnifiedOrderRequest struct {
	OrderNo     string
	AmountCents int64
	Description string
	ClientIP    string
	OpenID      string
}

type JSAPIParameters struct {
	AppID     string `json:"app_id"`
	TimeStamp string `json:"time_stamp"`
	NonceStr  string `json:"nonce_str"`
	Package   string `json:"package"`
	SignType  string `json:"sign_type"`
	PaySign   string `json:"pay_sign"`
}

type UnifiedOrderResult struct {
	PrepayID   string
	Parameters JSAPIParameters
}

type ProviderPayment struct {
	OrderNo       string
	AmountCents   int64
	TransactionID string
	PaidAt        time.Time
	Paid          bool
}

type CloseOutcome string

const (
	CloseOutcomeClosed CloseOutcome = "closed"
	CloseOutcomePaid   CloseOutcome = "paid"
)

type Gateway interface {
	UnifiedOrder(context.Context, UnifiedOrderRequest) (UnifiedOrderResult, error)
	QueryOrder(context.Context, string) (ProviderPayment, error)
	CloseOrder(context.Context, string) (CloseOutcome, error)
	ParseNotification([]byte) (ProviderPayment, error)
}

type VerifiedPayment struct {
	OrderNo       string
	AmountCents   int64
	TransactionID string
	PaidAt        time.Time
}

type SettlementResult struct {
	Order        paymentdomain.Order
	BalanceCents int64
	Credited     bool
}

type Settlement interface {
	CreditRecharge(context.Context, VerifiedPayment) (SettlementResult, error)
}

// TeamFundCredit 是一笔队费订单的入账信息：归属球队、入账人（付款的队长/领队）与金额。
// 钱计入付款人在该球队的个人账户余额，不是球队公共余额。
type TeamFundCredit struct {
	TeamID      int64
	UserID      int64
	AmountCents int64
}

type MembershipSettlement interface {
	ApplyMembershipPayment(context.Context, VerifiedPayment, TeamFundCredit) (SettlementResult, error)
}

// TeamEligibility 供下单用例校验球队与操作者身份（由 team 模块实现）。
type TeamEligibility interface {
	EnsureManager(context.Context, int64, int64) error
	EnsureExists(context.Context, int64) error
}

// MatchRegistrationFee 是一笔报名费下单前的校验上下文：金额取自比赛定价。
type MatchRegistrationFee struct {
	MatchID     uuid.UUID
	AmountCents int64
}

// MatchRegistrationFeeSource 供报名费下单校验（由 match 模块实现）：
// 比赛必须是赛前支付且有人均费用，操作者已报名（attending）且尚未支付。
type MatchRegistrationFeeSource interface {
	RegistrationFee(ctx context.Context, matchID uuid.UUID, userID int64) (MatchRegistrationFee, error)
}

// RegistrationSettlement 报名费订单核销：事务内核销订单并把对应报名标记为已支付
// （由 payment 的 postgres 仓储实现，直写 match_registrations 与队费直写 team_members 同风格）。
type MatchRegistrationCredit struct {
	MatchID     uuid.UUID
	UserID      int64
	AmountCents int64
}

type RegistrationSettlement interface {
	ApplyRegistrationPayment(context.Context, VerifiedPayment, MatchRegistrationCredit) (SettlementResult, error)
}

type OrderNumberGenerator interface {
	NewOrderNo() string
}

type Clock interface {
	Now() time.Time
}
