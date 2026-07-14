package ports

import (
	"context"

	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

type Repository interface {
	FindByID(context.Context, int64) (domain.Team, bool, error)
	FindActiveMember(context.Context, int64, int64) (domain.Member, bool, error)
	ListByUser(context.Context, int64) ([]domain.TeamMembership, error)
}
