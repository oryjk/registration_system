package ports

import (
	"context"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

type UserRegistrationRepository interface {
	WithinUserRegistrationTransaction(context.Context, func(UserRegistrationTransaction) error) error
}

type UserRegistrationTransaction interface {
	FindMatchForUpdate(context.Context, uuid.UUID) (domain.Match, bool, error)
	FindGroupForUpdate(context.Context, uuid.UUID, uuid.UUID) (domain.RegistrationGroup, bool, error)
	FindUserRegistrationForUpdate(context.Context, uuid.UUID, int64) (domain.Registration, bool, error)
	FindActiveUserRegistrationInMatchForUpdate(context.Context, uuid.UUID, int64) (domain.Registration, bool, error)
	CountAttendingForGroup(context.Context, uuid.UUID) (int, error)
	SaveRegistration(context.Context, domain.Registration) error
	UpdateGroup(context.Context, domain.RegistrationGroup) error
	UpdateMatchOpponent(context.Context, domain.Match) error
}
