package ports

import (
	"context"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

// ShareBgStore 保存比赛自定义分享卡背景图并返回公网可访问 URL。
type ShareBgStore interface {
	Save(ctx context.Context, key string, contentType string, data []byte) (string, error)
}

// NewMatchDefaultShareBgResolver 解析新建比赛时球队自动继承的默认分享背景。
// TeamVipEntitlement 自动满足该接口。
type NewMatchDefaultShareBgResolver interface {
	ResolveDefaultShareBgForNewMatch(ctx context.Context, teamID int64) (imageURL string, unlocked bool, err error)
}

// TeamVipEntitlement 抽象球队会员权益与球队级分享背景资源库能力，
// 在 bootstrap 中由 team 领域服务适配实现，避免 match 直接查 teams 表。
type TeamVipEntitlement interface {
	HasCustomShareBgAccess(ctx context.Context, teamID int64, matchUnlocked bool) (bool, error)
	ConsumeCreditForCustomShareBg(ctx context.Context, teamID int64) (bool, error)
	RecordShareBackground(ctx context.Context, teamID int64, imageURL string, uploadedByUserID int64) error
	HasTeamShareBackground(ctx context.Context, teamID int64, imageURL string) (bool, error)
	ResolveDefaultShareBgForNewMatch(ctx context.Context, teamID int64) (imageURL string, unlocked bool, err error)
}

// ShareBgRepository 定义比赛自定义分享背景读写所需的最小仓储能力。
type ShareBgRepository interface {
	FindMatch(ctx context.Context, matchID uuid.UUID) (domain.Match, bool, error)
	UpdateShareBgImage(ctx context.Context, matchID uuid.UUID, imageURL string, unlocked bool) error
}
