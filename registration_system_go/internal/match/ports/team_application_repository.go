package ports

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

var ErrActiveTeamApplication = errors.New("active team application already exists")

type TeamApplicationItem struct {
	Application domain.TeamApplication
	TeamName    string
}

type TeamApplicationRepository interface {
	FindMatch(context.Context, uuid.UUID) (domain.Match, bool, error)
	ListApplications(context.Context, uuid.UUID) ([]TeamApplicationItem, error)
	ListApplicationsForManager(context.Context, uuid.UUID, int64) ([]TeamApplicationItem, error)
	WithinTeamApplicationTransaction(context.Context, func(TeamApplicationTransaction) error) error
}

// TeamApplicationTransaction exposes persistence operations on one database
// transaction. The application layer keeps all state transitions in the domain.
type TeamApplicationTransaction interface {
	FindMatch(context.Context, uuid.UUID) (domain.Match, bool, error)
	FindApplication(context.Context, uuid.UUID, uuid.UUID) (domain.TeamApplication, bool, error)
	ListPendingApplications(context.Context, uuid.UUID) ([]domain.TeamApplication, error)
	FindActiveGuestGroup(context.Context, uuid.UUID) (domain.RegistrationGroup, bool, error)
	CreateApplication(context.Context, domain.TeamApplication) error
	UpdateApplication(context.Context, domain.TeamApplication) error
	CreateGroup(context.Context, domain.RegistrationGroup) error
	UpdateMatchOpponent(context.Context, domain.Match) error
	UpdateGroup(context.Context, domain.RegistrationGroup) error
}
