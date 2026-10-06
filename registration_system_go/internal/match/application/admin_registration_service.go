package application

import (
	"context"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// AdminRegistrationService 是管理端球队出勤补录入口，不受用户报名窗口限制。
type AdminRegistrationService struct {
	repository ports.UserRegistrationRepository
	clock      ports.Clock
}

func NewAdminRegistrationService(repository ports.UserRegistrationRepository, clock ports.Clock) AdminRegistrationService {
	return AdminRegistrationService{repository: repository, clock: clock}
}

func (s AdminRegistrationService) Put(ctx context.Context, actor sharedauth.Actor, matchID, groupID uuid.UUID, userID int64, status domain.RegistrationStatus) (domain.Registration, error) {
	if !actor.IsAdmin() {
		return domain.Registration{}, sharederror.ErrForbidden
	}
	if matchID == uuid.Nil || groupID == uuid.Nil || userID <= 0 {
		return domain.Registration{}, sharederror.New(sharederror.KindValidation, "比赛、报名组或队员无效")
	}
	// 先校验可编辑状态，避免将 unregistered（无记录）等展示值写入数据库。
	if !status.IsAdminEditable() {
		return domain.Registration{}, sharederror.New(sharederror.KindValidation, "报名状态无效")
	}
	now := s.clock.Now()
	var result domain.Registration
	err := s.repository.WithinUserRegistrationTransaction(ctx, func(tx ports.UserRegistrationTransaction) error {
		match, group, err := loadUserRegistrationContext(ctx, tx, matchID, groupID)
		if err != nil {
			return err
		}
		if match.Status == domain.MatchCancelled || group.Status == domain.GroupCancelled {
			return sharederror.New(sharederror.KindConflict, "已取消的比赛或报名组不可修改")
		}
		if err := authorizeAdminTeamRegistration(ctx, tx, match, group, userID); err != nil {
			return err
		}
		current, found, err := tx.FindUserRegistrationForUpdate(ctx, groupID, userID)
		if err != nil {
			return wrapUserRegistrationStoreError("查询报名记录失败", err)
		}
		otherActive, err := tx.HasOtherActiveRegistrationInMatch(ctx, matchID, groupID, userID)
		if err != nil {
			return wrapUserRegistrationStoreError("查询已有报名失败", err)
		}
		if otherActive {
			return sharederror.New(sharederror.KindConflict, "队员已在其他报名组中")
		}
		wasAttending := found && current.OccupiesCapacity()
		if !found {
			current, err = domain.NewRegistration(groupID, userID, status, 1, now)
			if err != nil {
				return err
			}
		} else if err := current.ApplyAdminStatus(status, now); err != nil {
			return err
		}
		if current.OccupiesCapacity() && !wasAttending {
			attending, err := tx.CountAttendingForGroup(ctx, groupID)
			if err != nil {
				return wrapUserRegistrationStoreError("统计报名人数失败", err)
			}
			if group.MaxPlayers != nil && attending+current.RegistrationCount > *group.MaxPlayers {
				return sharederror.New(sharederror.KindConflict, "报名人数已达上限")
			}
		}
		if err := tx.SaveRegistration(ctx, current); err != nil {
			return mapUserRegistrationSaveError(err)
		}
		result = current
		return nil
	})
	return result, err
}

func authorizeAdminTeamRegistration(ctx context.Context, tx ports.UserRegistrationTransaction, match domain.Match, group domain.RegistrationGroup, userID int64) error {
	var expectedTeamID *int64
	switch group.Kind {
	case domain.GroupHostTeam:
		expectedTeamID = match.HostTeamID
	case domain.GroupGuestTeam:
		if match.OpponentState != domain.OpponentConfirmed {
			return sharederror.New(sharederror.KindConflict, "客队报名组尚未确认")
		}
		expectedTeamID = match.AwayTeamID
	default:
		return sharederror.New(sharederror.KindValidation, "仅支持修改球队队员的报名状态")
	}
	if expectedTeamID == nil || group.TeamID == nil || *expectedTeamID != *group.TeamID {
		return sharederror.New(sharederror.KindConflict, "报名组与球队不匹配")
	}
	member, err := tx.IsTeamMember(ctx, *group.TeamID, userID)
	if err != nil {
		return wrapUserRegistrationStoreError("查询球队成员失败", err)
	}
	if !member {
		return sharederror.New(sharederror.KindValidation, "队员不在该球队名单中")
	}
	return nil
}
