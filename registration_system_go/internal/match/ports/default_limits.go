package ports

import (
	"context"

	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

type DefaultLimits interface {
	Resolve(context.Context, int) (domain.IndividualLimits, error)
}
