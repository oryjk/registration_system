package ports

import (
	"context"

	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

type Repository interface {
	FindByID(context.Context, int64) (domain.Team, bool, error)
	FindActiveMember(context.Context, int64, int64) (domain.Member, bool, error)
	// FindMembership 查成员关系（不限状态），用于离队成员的历史出勤等查询。
	FindMembership(context.Context, int64, int64) (domain.Member, bool, error)
	ListByUser(context.Context, int64) ([]domain.TeamMembership, error)
	List(context.Context, *domain.TeamStatus) ([]domain.Team, error)
	Create(context.Context, domain.Team) (domain.Team, error)
	Update(context.Context, domain.Team) (domain.Team, error)
	// UpdateJoinPasswordHash 更新入队口令哈希（nil=清除，开放加入）；返回 found=false 表示球队不存在。
	UpdateJoinPasswordHash(ctx context.Context, teamID int64, hash *string) (bool, error)
	// Delete 物理删除，仅管理端使用；用户侧解散走 Dissolve。
	Delete(context.Context, int64) (bool, error)
	// Dissolve 用户侧解散球队（软删除）：status 置为 dissolved；found=false 表示球队不存在或不可解散。
	Dissolve(ctx context.Context, teamID int64) (bool, error)
	// FindDissolveBlockers 查询阻止球队解散的进行中引用（未结束比赛、进行中约队申请）。
	FindDissolveBlockers(ctx context.Context, teamID int64) (domain.DissolveBlockers, error)
}
