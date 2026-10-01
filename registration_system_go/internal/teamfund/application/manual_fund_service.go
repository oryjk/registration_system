package application

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	notificationapplication "github.com/oryjk/registration_system/registration_system_go/internal/notification/application"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	teamfundports "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/ports"
)

const (
	kindTeamFundCredited = "teamfund_credited"
	kindTeamFundConsumed = "teamfund_consumed"
	kindTeamFundReversed = "teamfund_reversed"
	maxIdempotencyKeyLen = 64
	maxManualNoteLen     = 120
)

// maxManualAmountCents 单笔人工动作上限（分）：人工记账是队费量级，
// 超出基本可判定为手滑；与管理端弹窗的上限保持一致。
const maxManualAmountCents = 1_000_000

type ManualFundRequest struct {
	TeamID      int64
	UserID      int64
	AmountCents int64
	Note        string
	// IdempotencyKey 客户端幂等键：同一键重试只记一笔；为空时仓储生成随机键（不具重放去重语义）。
	IdempotencyKey        string
	OriginalTransactionID int64 // 仅冲正
}

// ManualFundRepository 手动余额动作需要的窄端口。
type ManualFundRepository interface {
	ManualRecharge(ctx context.Context, action teamfundports.ManualFundAction) (teamfundports.ManualFundResult, error)
	ManualConsume(ctx context.Context, action teamfundports.ManualFundAction) (teamfundports.ManualFundResult, error)
	ManualReverse(ctx context.Context, action teamfundports.ManualFundAction) (teamfundports.ManualFundResult, error)
}

type ManualFundService struct {
	repository    ManualFundRepository
	authorizer    teamfundports.TeamManagerAuthorizer
	notifications NotificationSink
}

func NewManualFundService(repository ManualFundRepository, authorizer teamfundports.TeamManagerAuthorizer, notifications NotificationSink) *ManualFundService {
	return &ManualFundService{repository: repository, authorizer: authorizer, notifications: notifications}
}

// authorize 管理员可直接记账；普通用户必须是该球队 active 的队长/领队，普通队员不能替别人记账。
func (s *ManualFundService) authorize(ctx context.Context, actor sharedauth.Actor, teamID int64) error {
	if actor.IsAdmin() {
		return nil
	}
	if s.authorizer == nil {
		return sharederror.ErrForbidden
	}
	return s.authorizer.AuthorizeTeamManager(ctx, actor, teamID)
}

// operatorUserID 操作人取自后端认证身份；但管理员 ID 来自 admin_users，
// 而 team_fund_transactions.created_by_user_id 引用 users 表——管理员动作不写操作人（记 NULL），
// 避免外键失败或误记成同 ID 的另一个用户。队长/领队（用户身份）如实记录。
func operatorUserID(actor sharedauth.Actor) int64 {
	if actor.IsUser() {
		return actor.ID
	}
	return 0
}

// Recharge 人工充值：登记实际收到的线下款项（纯记账，不伪造微信支付），
// 入账自动标记付费会员并刷新最近充值时间，通知队员到账。
func (s *ManualFundService) Recharge(ctx context.Context, actor sharedauth.Actor, request ManualFundRequest) (teamfundports.ManualFundResult, error) {
	if err := s.authorize(ctx, actor, request.TeamID); err != nil {
		return teamfundports.ManualFundResult{}, err
	}
	if err := validateManualRequest(request, false); err != nil {
		return teamfundports.ManualFundResult{}, err
	}
	result, err := s.repository.ManualRecharge(ctx, teamfundports.ManualFundAction{
		TeamID: request.TeamID, UserID: request.UserID,
		AmountCents: request.AmountCents, Note: strings.TrimSpace(request.Note),
		OperatorUserID: operatorUserID(actor), IdempotencyKey: request.IdempotencyKey,
	})
	if err != nil {
		return teamfundports.ManualFundResult{}, mapManualFundError(err)
	}
	if !result.Duplicated {
		s.notify(ctx, request.UserID, kindTeamFundCredited, "队费充值到账",
			fmt.Sprintf("队费充值 +%s 已到账，当前余额 %s。", yuanLabel(request.AmountCents), balanceLabel(result.BalanceCents)),
			request.Note)
	}
	return result, nil
}

// Consume 人工消费扣费：扣减余额（允许扣成负数即欠款），不改变付费会员身份与最近充值时间。
func (s *ManualFundService) Consume(ctx context.Context, actor sharedauth.Actor, request ManualFundRequest) (teamfundports.ManualFundResult, error) {
	if err := s.authorize(ctx, actor, request.TeamID); err != nil {
		return teamfundports.ManualFundResult{}, err
	}
	// 消费必须写明原因，保证流水可追溯。
	request.Note = strings.TrimSpace(request.Note)
	if request.Note == "" {
		return teamfundports.ManualFundResult{}, sharederror.New(sharederror.KindValidation, "消费扣费需要填写原因")
	}
	if err := validateManualRequest(request, false); err != nil {
		return teamfundports.ManualFundResult{}, err
	}
	result, err := s.repository.ManualConsume(ctx, teamfundports.ManualFundAction{
		TeamID: request.TeamID, UserID: request.UserID,
		AmountCents: request.AmountCents, Note: request.Note,
		OperatorUserID: operatorUserID(actor), IdempotencyKey: request.IdempotencyKey,
	})
	if err != nil {
		return teamfundports.ManualFundResult{}, mapManualFundError(err)
	}
	if !result.Duplicated {
		s.notify(ctx, request.UserID, kindTeamFundConsumed, "队费消费扣费",
			fmt.Sprintf("队费消费 -%s，当前余额 %s。", yuanLabel(request.AmountCents), balanceLabel(result.BalanceCents)),
			request.Note)
	}
	return result, nil
}

// Reverse 冲正人工记账错误：反向金额回加/扣回，关联原流水，不删除或篡改历史。
func (s *ManualFundService) Reverse(ctx context.Context, actor sharedauth.Actor, request ManualFundRequest) (teamfundports.ManualFundResult, error) {
	if err := s.authorize(ctx, actor, request.TeamID); err != nil {
		return teamfundports.ManualFundResult{}, err
	}
	request.Note = strings.TrimSpace(request.Note)
	if request.Note == "" {
		return teamfundports.ManualFundResult{}, sharederror.New(sharederror.KindValidation, "冲正需要填写原因")
	}
	if err := validateManualRequest(request, true); err != nil {
		return teamfundports.ManualFundResult{}, err
	}
	result, err := s.repository.ManualReverse(ctx, teamfundports.ManualFundAction{
		TeamID: request.TeamID, UserID: request.UserID,
		Note: request.Note, OperatorUserID: operatorUserID(actor), IdempotencyKey: request.IdempotencyKey,
		OriginalTransactionID: request.OriginalTransactionID,
	})
	if err != nil {
		return teamfundports.ManualFundResult{}, mapManualFundError(err)
	}
	if !result.Duplicated {
		s.notify(ctx, request.UserID, kindTeamFundReversed, "队费记账冲正",
			fmt.Sprintf("一笔队费记账已冲正，当前余额 %s。", balanceLabel(result.BalanceCents)),
			request.Note)
	}
	return result, nil
}

func validateManualRequest(request ManualFundRequest, reversal bool) error {
	if request.TeamID <= 0 || request.UserID <= 0 {
		return sharederror.New(sharederror.KindValidation, "球队或成员无效")
	}
	if !reversal {
		if request.AmountCents <= 0 {
			return sharederror.New(sharederror.KindValidation, "金额需要大于 0")
		}
		if request.AmountCents > maxManualAmountCents {
			return sharederror.New(sharederror.KindValidation, "单笔金额不能超过 ¥10000，更大金额请拆分多笔")
		}
	} else if request.OriginalTransactionID <= 0 {
		return sharederror.New(sharederror.KindValidation, "原流水无效")
	}
	if len(request.Note) > maxManualNoteLen {
		return sharederror.New(sharederror.KindValidation, "备注不能超过 120 个字符")
	}
	if len(request.IdempotencyKey) > maxIdempotencyKeyLen {
		return sharederror.New(sharederror.KindValidation, "幂等键不能超过 64 个字符")
	}
	return nil
}

func mapManualFundError(err error) error {
	if errors.Is(err, teamfundports.ErrIdempotencyConflict) {
		return sharederror.New(sharederror.KindConflict, "同一幂等键已被不同金额使用，请勿复用重试键")
	}
	return err
}

func (s *ManualFundService) notify(ctx context.Context, userID int64, kind, title, content, note string) {
	if note != "" {
		content += "备注：" + note + "。"
	}
	message := notificationapplication.SystemNotification{
		UserID: userID, Kind: kind, Title: title, Content: content,
	}
	if err := s.notifications.Notify(ctx, message); err != nil {
		log.Printf("teamfund: 发送队费通知失败 user=%d: %v", userID, err)
	}
}
