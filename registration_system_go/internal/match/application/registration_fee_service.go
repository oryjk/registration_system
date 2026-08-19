package application

import (
	"context"

	"github.com/google/uuid"
	matchdomain "github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	matchports "github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// RegistrationFeeService 供 payment 模块在下单前校验报名费上下文：
// 比赛必须是赛前支付且有人均费用，操作者已报名（attending）且尚未支付。
// 金额取自比赛定价，不由下单方指定。
type RegistrationFeeService struct {
	repository matchports.UserMatchRepository
}

func NewRegistrationFeeService(repository matchports.UserMatchRepository) RegistrationFeeService {
	return RegistrationFeeService{repository: repository}
}

func (s RegistrationFeeService) RegistrationFee(ctx context.Context, matchID uuid.UUID, userID int64) (paymentports.MatchRegistrationFee, error) {
	item, groups, found, err := s.repository.FindForUser(ctx, matchID, userID)
	if err != nil {
		return paymentports.MatchRegistrationFee{}, sharederror.Wrap(sharederror.KindInternal, "查询比赛失败", err)
	}
	if !found {
		return paymentports.MatchRegistrationFee{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	match := item.Match
	if match.Status != matchdomain.MatchRegistering {
		return paymentports.MatchRegistrationFee{}, sharederror.New(sharederror.KindConflict, "比赛已不在报名阶段")
	}
	if match.PaymentMode != matchdomain.PaymentPrepaid {
		return paymentports.MatchRegistrationFee{}, sharederror.New(sharederror.KindValidation, "该比赛无需赛前支付报名费")
	}
	if match.FeePerPersonCents <= 0 {
		return paymentports.MatchRegistrationFee{}, sharederror.New(sharederror.KindValidation, "该比赛报名免费")
	}
	for _, group := range groups {
		registration := group.MyRegistration
		if registration == nil || registration.Status != matchdomain.RegistrationAttending {
			continue
		}
		if registration.Paid {
			return paymentports.MatchRegistrationFee{}, sharederror.New(sharederror.KindConflict, "报名费已支付，请勿重复支付")
		}
		return paymentports.MatchRegistrationFee{MatchID: matchID, AmountCents: match.FeePerPersonCents}, nil
	}
	return paymentports.MatchRegistrationFee{}, sharederror.New(sharederror.KindValidation, "请先报名后再支付报名费")
}
