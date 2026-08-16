package application

import (
	"context"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// FinishMatch 让主队队长在比赛过结束时间后收尾比赛：
// 标记为已结束或已取消。线上约队且已确认客队时，客队队长同样可以收尾。
// 管理端沿用 AdminMatchService.ChangeStatus。
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
	if err := u.ensureTeamCaptainCanFinish(ctx, match, actor.ID); err != nil {
		return domain.Match{}, err
	}
	if err := match.FinishByHost(command.Status, u.clock.Now()); err != nil {
		return domain.Match{}, err
	}
	updated, err := u.repository.FinishUpdateStatus(ctx, match)
	if err != nil {
		return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "更新比赛状态失败", err)
	}
	if !updated {
		// 读取后状态已被并发请求收尾，条件更新 0 行——后到者按冲突拒绝，
		// 避免覆盖先到的终态。
		return domain.Match{}, sharederror.New(sharederror.KindConflict, "比赛状态已被他人变更，请刷新后查看")
	}
	return match, nil
}

// ensureTeamCaptainCanFinish 主队队长始终可以收尾；线上约队已确认客队时，
// 客队队长也可以收尾——双方都会进入各自的报名详情页。领队不参与收尾。
func (u FinishMatch) ensureTeamCaptainCanFinish(ctx context.Context, match domain.Match, userID int64) error {
	hostErr := u.teamAccess.EnsureCaptain(ctx, match.HostTeamID, userID)
	if hostErr == nil {
		return nil
	}
	if match.PublicationMode == domain.OnlineTeam && match.AwayTeamID != nil {
		if awayErr := u.teamAccess.EnsureCaptain(ctx, *match.AwayTeamID, userID); awayErr == nil {
			return nil
		}
	}
	return hostErr
}
