package ports

import (
	"context"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

type AppMember struct {
	UserID    int64
	Nickname  string
	AvatarURL *string
	RealName  *string
	Role      domain.Role
	Status    domain.MemberStatus
	JoinedAt  time.Time
}

type AppQueryRepository interface {
	FindByID(context.Context, int64) (domain.Team, bool, error)
	FindActiveMember(context.Context, int64, int64) (domain.Member, bool, error)
	ListAppMembers(context.Context, int64) ([]AppMember, error)
}
