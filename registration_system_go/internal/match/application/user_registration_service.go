package application

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type UserRegistrationService struct {
	repository ports.UserRegistrationRepository
	clock      ports.Clock
}

type PutMyRegistrationCommand struct {
	Status            domain.RegistrationStatus
	RegistrationCount int
}

func NewUserRegistrationService(repository ports.UserRegistrationRepository, clock ports.Clock) UserRegistrationService {
	return UserRegistrationService{repository: repository, clock: clock}
}

func (s UserRegistrationService) Put(ctx context.Context, actor sharedauth.Actor, matchID, groupID uuid.UUID, command PutMyRegistrationCommand) (domain.Registration, error) {
	if err := validateUserRegistrationCommand(actor, matchID, groupID, command); err != nil {
		return domain.Registration{}, err
	}

	now := s.clock.Now()
	var result domain.Registration
	err := s.repository.WithinUserRegistrationTransaction(ctx, func(tx ports.UserRegistrationTransaction) error {
		match, group, err := loadUserRegistrationContext(ctx, tx, matchID, groupID)
		if err != nil {
			return err
		}
		if match.Status != domain.MatchRegistering {
			return sharederror.New(sharederror.KindConflict, "当前比赛不在报名中")
		}
		if !match.RegistrationOpenAt(now) {
			return sharederror.New(sharederror.KindConflict, "当前不在报名时间内")
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
		if err := authorizeUserRegistration(ctx, tx, actor.ID, match, group, command.Status); err != nil {
			return err
		}
		if err := authorizeRegistrationCount(match, group, command.RegistrationCount); err != nil {
			return err
		}
		if group.Status == domain.GroupCancelled {
			return sharederror.New(sharederror.KindConflict, "报名组已取消")
		}
		if found && current.Status == command.Status && current.CancelledAt == nil && current.RegistrationCount == command.RegistrationCount {
			result = current
			return nil
		}
		if found && current.Paid {
			return sharederror.New(sharederror.KindConflict, "已支付的报名不可修改")
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
		base := projected
		if command.Status == domain.RegistrationAttending {
			projected += command.RegistrationCount
		}
		if group.MaxPlayers != nil && projected > *group.MaxPlayers {
			remaining := *group.MaxPlayers - base
			if remaining < 0 {
				remaining = 0
			}
			return sharederror.New(sharederror.KindConflict, fmt.Sprintf("报名人数超过剩余名额（剩 %d 个）", remaining))
		}

		if found {
			if err := current.ApplyUserStatus(command.Status, command.RegistrationCount, now); err != nil {
				return err
			}
			result = current
		} else {
			result, err = domain.NewRegistration(groupID, actor.ID, command.Status, command.RegistrationCount, now)
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

	now := s.clock.Now()
	var result domain.Registration
	err := s.repository.WithinUserRegistrationTransaction(ctx, func(tx ports.UserRegistrationTransaction) error {
		match, group, err := loadUserRegistrationContext(ctx, tx, matchID, groupID)
		if err != nil {
			return err
		}
		if match.Status != domain.MatchRegistering {
			return sharederror.New(sharederror.KindConflict, "当前比赛不在报名中")
		}
		if !match.RegistrationOpenAt(now) {
			return sharederror.New(sharederror.KindConflict, "当前不在报名时间内")
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
		if current.Paid {
			return sharederror.New(sharederror.KindConflict, "已支付的报名不可取消")
		}

		attending, err := tx.CountAttendingForGroup(ctx, groupID)
		if err != nil {
			return wrapUserRegistrationStoreError("统计报名人数失败", err)
		}
		projected := attending
		if current.OccupiesCapacity() {
			projected -= current.RegistrationCount
		}
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
	if command.RegistrationCount < 1 {
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

func authorizeUserRegistration(ctx context.Context, tx ports.UserRegistrationTransaction, userID int64, match domain.Match, group domain.RegistrationGroup, status domain.RegistrationStatus) error {
	switch group.Kind {
	case domain.GroupHostTeam:
		if group.TeamID == nil || match.HostTeamID == nil || *group.TeamID != *match.HostTeamID {
			return sharederror.New(sharederror.KindConflict, "主队报名组状态不一致")
		}
		return ensureActiveRegistrationMember(ctx, tx, *group.TeamID, userID)
	case domain.GroupGuestTeam:
		if group.TeamID == nil || match.AwayTeamID == nil || match.OpponentState != domain.OpponentConfirmed || *group.TeamID != *match.AwayTeamID {
			return sharederror.New(sharederror.KindConflict, "客队报名组尚未确认")
		}
		return ensureActiveRegistrationMember(ctx, tx, *group.TeamID, userID)
	case domain.GroupIndividualOpponent:
		if status != domain.RegistrationAttending {
			return sharederror.New(sharederror.KindValidation, "散人报名组只支持参赛状态")
		}
		// 散人约球（无主队）没有主队成员概念；散人对手模式仍禁止主队队员混入。
		if match.HostTeamID != nil {
			member, err := tx.IsActiveTeamMember(ctx, *match.HostTeamID, userID)
			if err != nil {
				return wrapUserRegistrationStoreError("查询球队成员身份失败", err)
			}
			if member {
				return sharederror.ErrForbidden
			}
		}
		return nil
	default:
		return sharederror.New(sharederror.KindConflict, "报名组类型无效")
	}
}

// authorizeRegistrationCount 仅散人约球的散人组允许一次报多人；其余场景人数恒为 1。
func authorizeRegistrationCount(match domain.Match, group domain.RegistrationGroup, count int) error {
	if count == 1 {
		return nil
	}
	if match.PublicationMode == domain.OnlinePickup && group.Kind == domain.GroupIndividualOpponent {
		return nil
	}
	return sharederror.New(sharederror.KindValidation, "报名人数必须为 1")
}

func ensureActiveRegistrationMember(ctx context.Context, tx ports.UserRegistrationTransaction, teamID, userID int64) error {
	member, err := tx.IsActiveTeamMember(ctx, teamID, userID)
	if err != nil {
		return wrapUserRegistrationStoreError("查询球队成员身份失败", err)
	}
	if !member {
		return sharederror.ErrForbidden
	}
	return nil
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
