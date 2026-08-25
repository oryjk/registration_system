package application

import (
	"context"
	"fmt"
	"log"
	"strings"

	notificationapplication "github.com/oryjk/registration_system/registration_system_go/internal/notification/application"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	teamfundports "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/ports"
)

const kindTeamFundCredited = "teamfund_credited"

// maxAdminCreditCents 单笔手动充值上限（分）：手动充值是队费量级，
// 超出基本可判定为手滑；与管理端 CreditTeamFundModal 的上限保持一致。
const maxAdminCreditCents = 1_000_000

type AdminCreditRequest struct {
	TeamID      int64
	UserID      int64
	AmountCents int64
	Note        string
}

// AdminCreditRepository 仅需要手动充值能力的窄端口。
type AdminCreditRepository interface {
	AdminCredit(ctx context.Context, credit teamfundports.AdminCredit) (teamfundports.AdminCreditResult, error)
}

type AdminCreditService struct {
	repository    AdminCreditRepository
	notifications NotificationSink
}

func NewAdminCreditService(repository AdminCreditRepository, notifications NotificationSink) *AdminCreditService {
	return &AdminCreditService{repository: repository, notifications: notifications}
}

// Credit 管理员手动给队员队费余额追加金额（纯记账，无支付），并向队员发送到账通知。
func (s *AdminCreditService) Credit(ctx context.Context, actor sharedauth.Actor, request AdminCreditRequest) (teamfundports.AdminCreditResult, error) {
	if !actor.IsAdmin() {
		return teamfundports.AdminCreditResult{}, sharederror.ErrForbidden
	}
	if request.AmountCents <= 0 {
		return teamfundports.AdminCreditResult{}, sharederror.New(sharederror.KindValidation, "充值金额需要大于 0")
	}
	if request.AmountCents > maxAdminCreditCents {
		return teamfundports.AdminCreditResult{}, sharederror.New(sharederror.KindValidation, "单笔手动充值不能超过 ¥10000，更大金额请拆分多笔")
	}
	note := strings.TrimSpace(request.Note)
	result, err := s.repository.AdminCredit(ctx, teamfundports.AdminCredit{
		TeamID: request.TeamID, UserID: request.UserID,
		AmountCents: request.AmountCents, Note: note,
	})
	if err != nil {
		return result, err
	}
	content := fmt.Sprintf("队费充值 +%s 已到账，当前余额 %s。", yuanLabel(request.AmountCents), balanceLabel(result.BalanceCents))
	if note != "" {
		content += fmt.Sprintf("备注：%s。", note)
	}
	message := notificationapplication.SystemNotification{
		UserID: request.UserID, Kind: kindTeamFundCredited, Title: "队费充值到账", Content: content,
	}
	if err := s.notifications.Notify(ctx, message); err != nil {
		log.Printf("teamfund: 发送充值到账通知失败 user=%d: %v", request.UserID, err)
	}
	return result, nil
}
