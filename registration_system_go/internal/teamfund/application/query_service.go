package application

import (
	"context"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	teamfundports "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/ports"
)

// QueryService 用户端队费余额与流水查询（仅本人数据，无额外权限）。
type QueryService struct {
	repository teamfundports.Repository
}

func NewQueryService(repository teamfundports.Repository) *QueryService {
	return &QueryService{repository: repository}
}

func (s *QueryService) ListBalances(ctx context.Context, actor sharedauth.Actor) ([]teamfundports.TeamFundBalance, error) {
	if !actor.IsUser() {
		return nil, sharederror.ErrForbidden
	}
	return s.repository.ListBalances(ctx, actor.ID)
}

func (s *QueryService) ListTransactions(ctx context.Context, actor sharedauth.Actor, beforeID int64, limit int) ([]teamfundports.TeamFundTransaction, error) {
	if !actor.IsUser() {
		return nil, sharederror.ErrForbidden
	}
	return s.repository.ListTransactions(ctx, actor.ID, beforeID, limit)
}
