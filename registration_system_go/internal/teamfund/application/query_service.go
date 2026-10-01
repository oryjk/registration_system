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
	authorizer teamfundports.TeamManagerAuthorizer
}

func NewQueryService(repository teamfundports.Repository, authorizer teamfundports.TeamManagerAuthorizer) *QueryService {
	return &QueryService{repository: repository, authorizer: authorizer}
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

// ListMemberTransactions 管理员或该队队长/领队查看指定成员的队费流水（冲正需定位原流水）。
func (s *QueryService) ListMemberTransactions(ctx context.Context, actor sharedauth.Actor, teamID, userID, beforeID int64, limit int) ([]teamfundports.TeamFundTransaction, error) {
	if teamID <= 0 || userID <= 0 {
		return nil, sharederror.New(sharederror.KindValidation, "球队或成员无效")
	}
	if !actor.IsAdmin() {
		if s.authorizer == nil {
			return nil, sharederror.ErrForbidden
		}
		if err := s.authorizer.AuthorizeTeamManager(ctx, actor, teamID); err != nil {
			return nil, err
		}
	}
	return s.repository.ListMemberTransactions(ctx, teamID, userID, beforeID, limit)
}
