package domain

import sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"

type FeeType string

const (
	FeeTeamFund  FeeType = "team_fund"
	FeeOfflineAA FeeType = "offline_aa"
	FeeFree      FeeType = "free"
	FeeFixed     FeeType = "fixed_amount"
)

// Empty preserves the legacy payment contract for published clients and migrated matches.
func validateFeeType(kind FeeType, mode PaymentMode, cents int64) error {
	switch kind {
	case "":
		return nil
	case FeeOfflineAA, FeeFree, FeeTeamFund:
		if mode == PaymentPostpaid && cents == 0 {
			return nil
		}
	case FeeFixed:
		if cents > 0 {
			return nil
		}
	}
	return sharederror.New(sharederror.KindValidation, "费用类型与支付金额不一致")
}

func (m *Match) UpdateFeeConfig(kind FeeType, mode PaymentMode, cents int64) error {
	if err := validatePaymentConfig(mode.normalized(), cents); err != nil {
		return err
	}
	if err := validateFeeType(kind, mode.normalized(), cents); err != nil {
		return err
	}
	if kind == FeeTeamFund && m.HostTeamID == nil {
		return sharederror.New(sharederror.KindValidation, "队费扣除仅适用于球队比赛")
	}
	m.FeeType, m.PaymentMode, m.FeePerPersonCents = kind, mode.normalized(), cents
	m.IsFree = kind == FeeFree || (kind == "" && cents == 0 && m.IsFree)
	return nil
}
