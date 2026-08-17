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
	Delete(context.Context, int64) (bool, error)
}
