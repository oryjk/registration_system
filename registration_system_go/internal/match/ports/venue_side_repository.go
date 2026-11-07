package ports

import (
	"context"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

// VenueAccess 校验微信用户是否为场馆（users.is_venue，由管理端开通）。
type VenueAccess interface {
	EnsureVenue(ctx context.Context, userID int64) error
}

// VenueSideNotifier 通知被移出的球队成员；发送失败不影响移出结果。
type VenueSideNotifier interface {
	NotifyVenueTeamRemoved(ctx context.Context, userID int64, matchID uuid.UUID, matchName string) error
}

type VenueSideRepository interface {
	WithinVenueSideTransaction(context.Context, func(VenueSideTransaction) error) error
}

type VenueSideTransaction interface {
	FindMatchForUpdate(context.Context, uuid.UUID) (domain.Match, bool, error)
	ListActiveGroupsForUpdate(context.Context, uuid.UUID) ([]domain.RegistrationGroup, error)
	CountAttendingForGroup(context.Context, uuid.UUID) (int, error)
	ListRemovalRecipients(ctx context.Context, teamID int64, groupID uuid.UUID) ([]int64, error)
	CreateGroup(context.Context, domain.RegistrationGroup) error
	UpdateGroup(context.Context, domain.RegistrationGroup) error
	UpdateMatchOpponent(context.Context, domain.Match) error
}
