package ports

import (
	"context"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

// LineupPlayer 表示排阵中引用的球员基础展示信息。
type LineupPlayer struct {
	UserID    int64
	Nickname  string
	AvatarURL *string
}

// LineupRepository 定义比赛排阵型所需的最小持久化与用户查询能力。
type LineupRepository interface {
	FindMatch(context.Context, uuid.UUID) (domain.Match, bool, error)
	FindLineup(context.Context, uuid.UUID) (domain.MatchLineup, bool, error)
	UpsertLineup(context.Context, domain.MatchLineup) (domain.MatchLineup, error)
	FindUsersByIDs(context.Context, []int64) ([]LineupPlayer, error)
}

// LineupTeamNameReader 可选扩展：批量查询主客队名称，供公开阵型查看页直接展示球队名称。
type LineupTeamNameReader interface {
	FindTeamNamesByIDs(context.Context, []int64) (map[int64]string, error)
}

// LineupMiniCodeGenerator 定义为排阵型页面生成微信小程序码的能力。
type LineupMiniCodeGenerator interface {
	GenerateForPage(ctx context.Context, page, scene, environment string) (string, error)
}
