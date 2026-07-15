package ports

import (
	"context"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

type Repository interface {
	CreateWithGroups(context.Context, domain.Match, []domain.RegistrationGroup) error
	FindByID(context.Context, uuid.UUID) (domain.Match, []domain.RegistrationGroup, bool, error)
	FindForAdmin(context.Context, uuid.UUID) (AdminMatchItem, []domain.RegistrationGroup, bool, error)
	ListForAdmin(context.Context, AdminMatchFilter) ([]AdminMatchItem, error)
	CountForAdmin(context.Context, AdminMatchFilter) (int64, error)
	UpdateDetails(context.Context, domain.Match) error
	UpdateStatus(context.Context, domain.Match) error
	Delete(context.Context, uuid.UUID) (bool, error)
}

type AdminMatchFilter struct {
	Status *domain.MatchStatus
	Search string
	Limit  int
	Offset int
}

type AdminMatchItem struct {
	Match        domain.Match
	HostTeamName string
	AwayTeamName *string
}
