package application

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type UserRegistrationService struct {
	repository ports.UserRegistrationRepository
	teams      ports.TeamAccess
	clock      ports.Clock
}

type PutMyRegistrationCommand struct {
	Status            domain.RegistrationStatus
	RegistrationCount int
}

func NewUserRegistrationService(repository ports.UserRegistrationRepository, teams ports.TeamAccess, clock ports.Clock) UserRegistrationService {
	return UserRegistrationService{repository: repository, teams: teams, clock: clock}
}

func (s UserRegistrationService) Put(ctx context.Context, actor sharedauth.Actor, matchID, groupID uuid.UUID, command PutMyRegistrationCommand) (domain.Registration, error) {
	if err := validateUserRegistrationCommand(actor, matchID, groupID, command); err != nil {
		return domain.Registration{}, err
	}

	var result domain.Registration
	err := s.repository.WithinUserRegistrationTransaction(ctx, func(tx ports.UserRegistrationTransaction) error {
		match, group, err := loadUserRegistrationContext(ctx, tx, matchID, groupID)
		if err != nil {
			return err
		}
		if match.Status != domain.MatchRegistering {
			return sharederror.New(sharederror.KindConflict, "当前比赛不在报名中")
		}

		current, found, err := tx.FindUserRegistrationForUpdate(ctx, groupID, actor.ID)
		if err != nil {
			return wrapUserRegistrationStoreError("查询报名记录失败", err)
		}
		active, activeFound, err := tx.FindActiveUserRegistrationInMatchForUpdate(ctx, matchID, actor.ID)
		if err != nil {
			return wrapUserRegistrationStoreError("查询比赛报名状态失败", err)
		}
		if activeFound && active.GroupID != groupID {
			return sharederror.New(sharederror.KindConflict, "用户已在本场比赛的其他分组报名")
		}
		if err := s.authorizePut(ctx, actor.ID, match, group, command.Status); err != nil {
			return err
		}
		if group.Status == domain.GroupCancelled {
			return sharederror.New(sharederror.KindConflict, "报名组已取消")
		}
		if found && current.Status == command.Status && current.CancelledAt == nil && current.RegistrationCount == 1 {
			result = current
			return nil
		}
		if group.Status != domain.GroupOpen {
			return sharederror.New(sharederror.KindConflict, "报名组未开放")
		}

		attending, err := tx.CountAttendingForGroup(ctx, groupID)
		if err != nil {
			return wrapUserRegistrationStoreError("统计报名人数失败", err)
		}
		projected := attending
		if found && current.OccupiesCapacity() {
			projected -= current.RegistrationCount
		}
		if command.Status == domain.RegistrationAttending {
			projected++
		}
		if group.MaxPlayers != nil && projected > *group.MaxPlayers {
			return sharederror.New(sharederror.KindConflict, "报名组人数已满")
		}

		now := s.clock.Now()
		if found {
			if err := current.ApplyUserStatus(command.Status, now); err != nil {
				return err
			}
			result = current
		} else {
			result, err = domain.NewRegistration(groupID, actor.ID, command.Status, 1, now)
			if err != nil {
				return err
			}
		}
		if err := tx.SaveRegistration(ctx, result); err != nil {
			return mapUserRegistrationSaveError(err)
		}
		return updateIndividualRegistrationState(ctx, tx, &match, &group, projected, now)
	})
	return result, err
}

func (s UserRegistrationService) Delete(ctx context.Context, actor sharedauth.Actor, matchID, groupID uuid.UUID) (domain.Registration, error) {
	if !actor.IsUser() {
		return domain.Registration{}, sharederror.ErrForbidden
	}
	if matchID == uuid.Nil || groupID == uuid.Nil {
		return domain.Registration{}, sharederror.New(sharederror.KindValidation, "比赛或报名组无效")
	}

	var result domain.Registration
	err := s.repository.WithinUserRegistrationTransaction(ctx, func(tx ports.UserRegistrationTransaction) error {
		match, group, err := loadUserRegistrationContext(ctx, tx, matchID, groupID)
		if err != nil {
			return err
		}
		if match.Status != domain.MatchRegistering {
			return sharederror.New(sharederror.KindConflict, "当前比赛不在报名中")
		}
		current, found, err := tx.FindUserRegistrationForUpdate(ctx, groupID, actor.ID)
		if err != nil {
			return wrapUserRegistrationStoreError("查询报名记录失败", err)
		}
		if !found {
			return sharederror.New(sharederror.KindNotFound, "报名记录不存在")
		}
		if current.Status == domain.RegistrationCancelled {
			result = current
			return nil
		}

		attending, err := tx.CountAttendingForGroup(ctx, groupID)
		if err != nil {
			return wrapUserRegistrationStoreError("统计报名人数失败", err)
		}
		projected := attending
		if current.OccupiesCapacity() {
			projected -= current.RegistrationCount
		}
		now := s.clock.Now()
		current.Cancel(now)
		result = current
		if err := tx.SaveRegistration(ctx, result); err != nil {
			return mapUserRegistrationSaveError(err)
		}
		return updateIndividualRegistrationState(ctx, tx, &match, &group, projected, now)
	})
	return result, err
}

func validateUserRegistrationCommand(actor sharedauth.Actor, matchID, groupID uuid.UUID, command PutMyRegistrationCommand) error {
	if !actor.IsUser() {
		return sharederror.ErrForbidden
	}
	if matchID == uuid.Nil || groupID == uuid.Nil {
		return sharederror.New(sharederror.KindValidation, "比赛或报名组无效")
	}
	if command.RegistrationCount != 1 {
		return sharederror.New(sharederror.KindValidation, "报名人数必须为 1")
	}
	switch command.Status {
	case domain.RegistrationAttending, domain.RegistrationLeave, domain.RegistrationAbsent:
		return nil
	default:
		return sharederror.New(sharederror.KindValidation, "报名状态无效")
	}
}

func loadUserRegistrationContext(ctx context.Context, tx ports.UserRegistrationTransaction, matchID, groupID uuid.UUID) (domain.Match, domain.RegistrationGroup, error) {
	match, found, err := tx.FindMatchForUpdate(ctx, matchID)
	if err != nil {
		return domain.Match{}, domain.RegistrationGroup{}, wrapUserRegistrationStoreError("查询比赛失败", err)
	}
	if !found {
		return domain.Match{}, domain.RegistrationGroup{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	group, found, err := tx.FindGroupForUpdate(ctx, matchID, groupID)
	if err != nil {
		return domain.Match{}, domain.RegistrationGroup{}, wrapUserRegistrationStoreError("查询报名组失败", err)
	}
	if !found {
		return domain.Match{}, domain.RegistrationGroup{}, sharederror.New(sharederror.KindNotFound, "报名组不存在")
	}
	return match, group, nil
}

func (s UserRegistrationService) authorizePut(ctx context.Context, userID int64, match domain.Match, group domain.RegistrationGroup, status domain.RegistrationStatus) error {
	switch group.Kind {
	case domain.GroupHostTeam:
		if group.TeamID == nil || *group.TeamID != match.HostTeamID {
			return sharederror.New(sharederror.KindConflict, "主队报名组状态不一致")
		}
		return s.teams.EnsureActiveMember(ctx, *group.TeamID, userID)
	case domain.GroupGuestTeam:
		if group.TeamID == nil || match.AwayTeamID == nil || match.OpponentState != domain.OpponentConfirmed || *group.TeamID != *match.AwayTeamID {
			return sharederror.New(sharederror.KindConflict, "客队报名组尚未确认")
		}
		return s.teams.EnsureActiveMember(ctx, *group.TeamID, userID)
	case domain.GroupIndividualOpponent:
		if status != domain.RegistrationAttending {
			return sharederror.New(sharederror.KindValidation, "散人报名组只支持参赛状态")
		}
		member, err := s.teams.IsActiveMember(ctx, match.HostTeamID, userID)
		if err != nil {
			return err
		}
		if member {
			return sharederror.ErrForbidden
		}
		return nil
	default:
		return sharederror.New(sharederror.KindConflict, "报名组类型无效")
	}
}

func updateIndividualRegistrationState(ctx context.Context, tx ports.UserRegistrationTransaction, match *domain.Match, group *domain.RegistrationGroup, attending int, now time.Time) error {
	if group.Kind != domain.GroupIndividualOpponent {
		return nil
	}
	if group.MinPlayers == nil {
		return sharederror.New(sharederror.KindConflict, "散人报名组人数规则无效")
	}
	if err := group.RecalculateIndividualStatus(attending, now); err != nil {
		return err
	}
	if err := match.RecalculateIndividualOpponent(attending, *group.MinPlayers, now); err != nil {
		return err
	}
	if err := tx.UpdateGroup(ctx, *group); err != nil {
		return wrapUserRegistrationStoreError("更新报名组状态失败", err)
	}
	if err := tx.UpdateMatchOpponent(ctx, *match); err != nil {
		return wrapUserRegistrationStoreError("更新比赛对手状态失败", err)
	}
	return nil
}

func wrapUserRegistrationStoreError(message string, err error) error {
	return sharederror.Wrap(sharederror.KindInternal, message, err)
}

func mapUserRegistrationSaveError(err error) error {
	switch {
	case errors.Is(err, ports.ErrUserRegistrationConflict):
		return sharederror.New(sharederror.KindConflict, "报名状态冲突")
	case errors.Is(err, ports.ErrUserRegistrationValidation):
		return sharederror.New(sharederror.KindValidation, "报名数据无效")
	default:
		return wrapUserRegistrationStoreError("保存报名记录失败", err)
	}
}
