package ports

import (
	"context"

	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

// VipRepository 承载球队会员状态、单次权益扣减与球队分享背景资源库的持久化操作。
type VipRepository interface {
	FindByID(ctx context.Context, teamID int64) (domain.Team, bool, error)
	FindActiveMember(ctx context.Context, teamID, userID int64) (domain.Member, bool, error)
	FindVipStatus(ctx context.Context, teamID int64) (domain.VipStatus, bool, error)
	ConsumeVipCredit(ctx context.Context, teamID int64) (bool, error)
	RecordShareBackground(ctx context.Context, teamID int64, imageURL string, uploadedByUserID *int64) error
	ListShareBackgrounds(ctx context.Context, teamID int64) ([]domain.ShareBackground, string, error)
	HasTeamShareBackground(ctx context.Context, teamID int64, imageURL string) (bool, error)
}
