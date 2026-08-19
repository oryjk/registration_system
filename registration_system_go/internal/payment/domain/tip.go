package domain

import (
	"strings"
	"time"
	"unicode/utf8"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// TipStatus 打赏记录状态：随订单落库为 pending，支付回调核销后置 submitted
// （submitted = 支付成功、建议已生效，非"待审核"；订单取消/失败时停留 pending 属预期）。
type TipStatus string

const (
	TipStatusPending   TipStatus = "pending"
	TipStatusSubmitted TipStatus = "submitted"
)

// MaxTipSuggestionRunes 限制功能建议长度，避免超长文本滥用。
const MaxTipSuggestionRunes = 500

// Tip 是一笔打赏的快照记录：昵称在下单时从 users 表快照（回调路径无登录态），
// 功能建议仅在支付成功后随 submitted 状态对管理端可见。
type Tip struct {
	OrderNo     string
	UserID      int64
	Nickname    string
	AmountCents int64
	Suggestion  string
	Status      TipStatus
	CreatedAt   time.Time
	SubmittedAt *time.Time
}

// NewTip 从打赏订单构造快照记录；建议文本可选，收尾去空白。
func NewTip(order Order, nickname, suggestion string) (Tip, error) {
	if order.Kind != KindTip {
		return Tip{}, sharederror.New(sharederror.KindValidation, "该订单不是打赏订单")
	}
	nickname = strings.TrimSpace(nickname)
	suggestion = strings.TrimSpace(suggestion)
	if utf8.RuneCountInString(suggestion) > MaxTipSuggestionRunes {
		return Tip{}, sharederror.New(sharederror.KindValidation, "功能建议过长")
	}
	return Tip{
		OrderNo: order.OrderNo, UserID: order.UserID, Nickname: nickname,
		AmountCents: order.AmountCents, Suggestion: suggestion,
		Status: TipStatusPending, CreatedAt: order.CreatedAt,
	}, nil
}
