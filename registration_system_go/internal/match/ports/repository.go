package ports

import (
	"context"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

type Repository interface {
	CreateWithGroups(context.Context, domain.Match, []domain.RegistrationGroup) error
	FindByID(context.Context, uuid.UUID) (domain.Match, []domain.RegistrationGroup, bool, error)
}
