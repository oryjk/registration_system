package application

import (
	"context"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// FinishMatch 让主队管理方（队长/领队）在比赛过结束时间后收尾比赛：
// 标记为已结束或已取消。管理端沿用 AdminMatchService.ChangeStatus。
type FinishMatch struct {
	repository ports.Repository
	teamAccess ports.TeamAccess
	clock      ports.Clock
}

type FinishMatchCommand struct {
	Status domain.MatchStatus
}

func NewFinishMatch(repository ports.Repository, teamAccess ports.TeamAccess, clock ports.Clock) FinishMatch {
	return FinishMatch{repository: repository, teamAccess: teamAccess, clock: clock}
}

func (u FinishMatch) Execute(ctx context.Context, actor sharedauth.Actor, matchID uuid.UUID, command FinishMatchCommand) (domain.Match, error) {
	if !actor.IsUser() {
		return domain.Match{}, sharederror.ErrForbidden
	}
	if command.Status != domain.MatchEnded && command.Status != domain.MatchCancelled {
		return domain.Match{}, sharederror.New(sharederror.KindValidation, "收尾状态只能是已结束或已取消")
	}
	match, _, found, err := u.repository.FindByID(ctx, matchID)
	if err != nil {
		return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "查询比赛失败", err)
	}
	if !found {
		return domain.Match{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	if err := u.teamAccess.EnsureManager(ctx, match.HostTeamID, actor.ID); err != nil {
		return domain.Match{}, err
	}
	if err := match.FinishByHost(command.Status, u.clock.Now()); err != nil {
		return domain.Match{}, err
	}
	if err := u.repository.UpdateStatus(ctx, match); err != nil {
		return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "更新比赛状态失败", err)
	}
	return match, nil
}
