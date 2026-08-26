package ports

import (
	"context"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

// AppTeamSummary 用户侧球队搜索结果：球队基础信息 + 当前成员数 + 信用/会员展示数据。
type AppTeamSummary struct {
	Team        domain.Team
	MemberCount int64
	CreditScore int
	VipUntil    *time.Time
}

// TeamPasswordHasher 入队口令的哈希与校验，由 bcrypt 适配器实现。
type TeamPasswordHasher interface {
	Hash(password string) (string, error)
	Verify(hash, password string) bool
}

// AppTeamSelfRepository 支撑小程序无球队用户的自服务：创建、加入、搜索球队与入队口令查询。
type AppTeamSelfRepository interface {
	FindByID(context.Context, int64) (domain.Team, bool, error)
	TeamNameExists(context.Context, string) (bool, error)
	// CreateWithCaptain 原子创建球队并把 creator 加入为队长成员。
	CreateWithCaptain(ctx context.Context, name string, description, joinPasswordHash *string, captainID int64) (domain.Team, error)
	SearchByKeyword(ctx context.Context, keyword string) ([]AppTeamSummary, error)
	// FindJoinPasswordHash 返回入队口令哈希；第二个返回值表示球队是否存在。
	FindJoinPasswordHash(ctx context.Context, teamID int64) (*string, bool, error)
	FindMembership(context.Context, int64, int64) (domain.Member, bool, error)
	AddMember(context.Context, int64, int64, domain.Role) error
	// ReactivateMember 把历史 inactive/left 成员恢复为 active 普通队员，返回是否生效。
	ReactivateMember(context.Context, int64, int64) (bool, error)
	// GetTeamMembershipState 查询用户在该球队的队费余额（退出前校验余额须为零）。
	GetTeamMembershipState(context.Context, int64, int64) (AppMembershipState, error)
	// LeaveMember 成员自助退出（软删除 status -> left），返回是否生效。
	LeaveMember(context.Context, int64, int64) (bool, error)
	// FindUserNickname 查用户昵称，用于退出球队时给队长的站内通知文案。
	FindUserNickname(context.Context, int64) (string, bool, error)
}
