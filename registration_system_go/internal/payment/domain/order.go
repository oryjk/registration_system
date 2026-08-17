package domain

import (
	"strings"
	"time"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type Status string

const (
	StatusPending   Status = "pending"
	StatusPaid      Status = "paid"
	StatusCancelled Status = "cancelled"
	StatusFailed    Status = "failed"
)

const (
	ProviderWechat          = "wechat"
	ChannelMiniProgramJSAPI = "mini_program_jsapi"
)

type Kind string

const (
	KindRecharge       Kind = "recharge"
	KindTeamMembership Kind = "team_membership"
)

const (
	// MembershipMaxAmountCents 限制单笔队费金额（1 万元），防止误操作天价订单。
	MembershipMaxAmountCents int64 = 1_000_000
)

type Order struct {
	OrderNo       string
	UserID        int64
	AmountCents   int64
	Provider      string
	Channel       string
	Status        Status
	Kind          Kind
	TeamID        *int64
	Months        *int // 历史按月计价订单的月数；新队费订单恒为 nil
	PrepayID      string
	TransactionID string
	PaidAt        *time.Time
	CancelledAt   *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func NewRechargeOrder(orderNo string, userID, amountCents int64, now time.Time) (Order, error) {
	orderNo = strings.TrimSpace(orderNo)
	if orderNo == "" || len(orderNo) > 32 || userID <= 0 || amountCents < 1 {
		return Order{}, sharederror.New(sharederror.KindValidation, "充值订单参数无效")
	}
	return Order{
		OrderNo: orderNo, UserID: userID, AmountCents: amountCents,
		Provider: ProviderWechat, Channel: ChannelMiniProgramJSAPI, Status: StatusPending,
		Kind:      KindRecharge,
		CreatedAt: now, UpdatedAt: now,
	}, nil
}

// NewTeamMembershipOrder 为球队创建队费订单：金额由用户填写（分），与时间无关，归属发起人点击的球队。
func NewTeamMembershipOrder(orderNo string, userID, teamID, amountCents int64, now time.Time) (Order, error) {
	orderNo = strings.TrimSpace(orderNo)
	if orderNo == "" || len(orderNo) > 32 || userID <= 0 || teamID <= 0 {
		return Order{}, sharederror.New(sharederror.KindValidation, "队费订单参数无效")
	}
	if amountCents < 1 || amountCents > MembershipMaxAmountCents {
		return Order{}, sharederror.New(sharederror.KindValidation, "队费金额无效")
	}
	return Order{
		OrderNo: orderNo, UserID: userID, AmountCents: amountCents,
		Provider: ProviderWechat, Channel: ChannelMiniProgramJSAPI, Status: StatusPending,
		Kind: KindTeamMembership, TeamID: &teamID,
		CreatedAt: now, UpdatedAt: now,
	}, nil
}

func (o *Order) MarkPrepared(prepayID string, now time.Time) error {
	prepayID = strings.TrimSpace(prepayID)
	if prepayID == "" {
		return sharederror.New(sharederror.KindValidation, "微信预支付单号不能为空")
	}
	if o.Status != StatusPending {
		return sharederror.ErrConflict
	}
	if o.PrepayID == prepayID {
		return nil
	}
	if o.PrepayID != "" {
		return sharederror.ErrConflict
	}
	o.PrepayID = prepayID
	o.UpdatedAt = now
	return nil
}

func (o *Order) MarkPaid(transactionID string, paidAt time.Time) error {
	transactionID = strings.TrimSpace(transactionID)
	if transactionID == "" {
		return sharederror.New(sharederror.KindValidation, "微信交易号不能为空")
	}
	if o.Status == StatusPaid {
		if o.TransactionID == transactionID {
			return nil
		}
		return sharederror.ErrConflict
	}
	if o.Status != StatusPending {
		return sharederror.ErrConflict
	}
	o.Status = StatusPaid
	o.TransactionID = transactionID
	o.PaidAt = &paidAt
	o.UpdatedAt = paidAt
	return nil
}

func (o *Order) MarkCancelled(now time.Time) error {
	if o.Status == StatusCancelled {
		return nil
	}
	if o.Status != StatusPending {
		return sharederror.ErrConflict
	}
	o.Status = StatusCancelled
	o.CancelledAt = &now
	o.UpdatedAt = now
	return nil
}

func (o *Order) MarkFailed(now time.Time) error {
	if o.Status == StatusFailed {
		return nil
	}
	if o.Status != StatusPending {
		return sharederror.ErrConflict
	}
	o.Status = StatusFailed
	o.UpdatedAt = now
	return nil
}
