package defaults

import (
	"context"

	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

type Service struct{}

func (Service) Resolve(_ context.Context, playersPerTeam int) (domain.IndividualLimits, error) {
	return domain.ResolveIndividualLimits(playersPerTeam, nil)
}
