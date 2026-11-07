package application

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// RecordMatchScore 比赛管理员（管理端设置的微信用户）在小程序端
// 录入/修正比赛比分；比赛进行中或已结束均可。管理端走 AdminMatchService.RecordScore。
type RecordMatchScore struct {
	repository  ports.Repository
	adminAccess ports.MatchAdminAccess
	clock       ports.Clock
}

type RecordMatchScoreCommand struct {
	HostScore int
	AwayScore int
}

func NewRecordMatchScore(repository ports.Repository, adminAccess ports.MatchAdminAccess, clock ports.Clock) RecordMatchScore {
	return RecordMatchScore{repository: repository, adminAccess: adminAccess, clock: clock}
}

func (u RecordMatchScore) Execute(ctx context.Context, actor sharedauth.Actor, matchID uuid.UUID, command RecordMatchScoreCommand) (domain.Match, error) {
	if !actor.IsUser() {
		return domain.Match{}, sharederror.ErrForbidden
	}
	adminErr := u.adminAccess.EnsureMatchAdmin(ctx, actor.ID)
	if adminErr != nil && !errors.Is(adminErr, sharederror.ErrForbidden) {
		return domain.Match{}, adminErr
	}
	match, _, found, err := u.repository.FindByID(ctx, matchID)
	if err != nil {
		return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "查询比赛失败", err)
	}
	if !found {
		if adminErr != nil {
			return domain.Match{}, adminErr
		}
		return domain.Match{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	// 场馆组局的比分由发布比赛的场馆录入，其他比赛仍只有比赛管理员可录。
	publisher := match.PublicationMode == domain.VenueHosted && match.CreatedByUserID != nil && *match.CreatedByUserID == actor.ID
	if adminErr != nil && !publisher {
		return domain.Match{}, adminErr
	}
	if err := match.RecordScore(command.HostScore, command.AwayScore, u.clock.Now()); err != nil {
		return domain.Match{}, err
	}
	if err := u.repository.UpdateScore(ctx, match); err != nil {
		return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "更新比赛比分失败", err)
	}
	return match, nil
}
