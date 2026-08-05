package ports

import (
	"context"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

type Repository interface {
	CreateWithGroups(context.Context, domain.Match, []domain.RegistrationGroup) error
	CreateRegistration(context.Context, domain.Registration) error
	FindByID(context.Context, uuid.UUID) (domain.Match, []domain.RegistrationGroup, bool, error)
	FindForAdmin(context.Context, uuid.UUID) (AdminMatchItem, []domain.RegistrationGroup, bool, error)
	ListForAdmin(context.Context, AdminMatchFilter) ([]AdminMatchItem, error)
	CountForAdmin(context.Context, AdminMatchFilter) (int64, error)
	ListRosterForGroup(context.Context, domain.RegistrationGroup) ([]AdminRosterEntry, error)
	UpdateDetails(context.Context, domain.Match) error
	UpdateStatus(context.Context, domain.Match) error
	Delete(context.Context, uuid.UUID) (bool, error)
}

type MatchListFilter struct {
	Status *domain.MatchStatus
	Search string
	Limit  int
	Offset int
}

type AdminMatchFilter = MatchListFilter

type MatchItem struct {
	Match        domain.Match
	HostTeamName string
	AwayTeamName *string
}

type AdminMatchItem = MatchItem

type UserGroupState struct {
	Group          domain.RegistrationGroup
	AttendingCount int
	MyRegistration *domain.Registration
}

type HomeMatchItem struct {
	Item  MatchItem
	Group UserGroupState
}

type UserMatchRepository interface {
	ListForUser(context.Context, MatchListFilter) ([]MatchItem, error)
	CountForUser(context.Context, MatchListFilter) (int64, error)
	FindForUser(context.Context, uuid.UUID, int64) (MatchItem, []UserGroupState, bool, error)
	ListHomeActionItems(context.Context, int64, int) ([]HomeMatchItem, error)
	ListHomeEndedItems(context.Context, int64, int) ([]MatchItem, error)
}

// AdminRosterEntry 是管理端报名组花名册中的一行：球队组包含全部成员
// （Status 为 nil 表示尚未报名），散人组只包含已有报名记录的用户。
type AdminRosterEntry struct {
	UserID     int64
	Nickname   string
	RealName   *string
	AvatarURL  *string
	MemberRole *string
	Status     *domain.RegistrationStatus
}
