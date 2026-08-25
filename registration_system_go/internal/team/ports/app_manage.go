package ports

import (
	"context"

	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

// AppManageRepository 是小程序侧队长/领队管理球队（资料与成员）所需的输出端口。
// 成员增删改直接复用 admin 侧语义相同的仓储实现。
type AppManageRepository interface {
	FindByID(context.Context, int64) (domain.Team, bool, error)
	FindActiveMember(context.Context, int64, int64) (domain.Member, bool, error)
	// FindMembership 查成员关系（不限状态），用于按 role?/status? 部分更新时补齐现状。
	FindMembership(context.Context, int64, int64) (domain.Member, bool, error)
	// ActiveUserExists 校验目标用户存在且为 active，用于添加成员。
	ActiveUserExists(context.Context, int64) (bool, error)
	UpdateTeamProfile(context.Context, domain.Team) (domain.Team, error)
	// UpdateJoinPasswordHash 更新入队口令哈希（nil=清除，开放加入）；返回 found=false 表示球队不存在。
	UpdateJoinPasswordHash(ctx context.Context, teamID int64, hash *string) (bool, error)
	AddMember(context.Context, int64, int64, domain.Role) error
	UpdateMember(context.Context, int64, int64, domain.Role, domain.MemberStatus) (bool, error)
	RemoveMember(context.Context, int64, int64) (bool, error)
	// Delete 物理删除球队；仍被比赛/报名组/约队申请/支付订单引用时
	// 返回 ErrConflict。返回 found=false 表示球队不存在。
	Delete(context.Context, int64) (bool, error)
	// Dissolve 用户侧解散球队（软删除）：status 置为 dissolved；
	// found=false 表示球队不存在或当前状态不可解散。
	Dissolve(ctx context.Context, teamID int64) (bool, error)
	// FindDissolveBlockers 查询阻止球队解散的进行中引用（未结束比赛、进行中约队申请）。
	FindDissolveBlockers(ctx context.Context, teamID int64) (domain.DissolveBlockers, error)
}
