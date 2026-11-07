package application

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// VenueSideService 场馆组局的占边、退出和移出。
// 所有操作在同一事务内持有比赛行锁，与报名互斥，避免球队和散人同时抢到同一边。
type VenueSideService struct {
	repository    ports.VenueSideRepository
	teams         ports.TeamAccess
	defaultLimits ports.DefaultLimits
	notifier      ports.VenueSideNotifier
	clock         ports.Clock
}

func NewVenueSideService(repository ports.VenueSideRepository, teams ports.TeamAccess, defaultLimits ports.DefaultLimits, notifier ports.VenueSideNotifier, clock ports.Clock) VenueSideService {
	return VenueSideService{repository: repository, teams: teams, defaultLimits: defaultLimits, notifier: notifier, clock: clock}
}

// Claim 队长或领队带队占下一个还没有人报名的边。
func (s VenueSideService) Claim(ctx context.Context, actor sharedauth.Actor, matchID uuid.UUID, teamID int64) (domain.RegistrationGroup, error) {
	if !actor.IsUser() {
		return domain.RegistrationGroup{}, sharederror.ErrForbidden
	}
	if err := s.teams.EnsureActive(ctx, teamID); err != nil {
		return domain.RegistrationGroup{}, err
	}
	if err := s.teams.EnsureManager(ctx, teamID, actor.ID); err != nil {
		return domain.RegistrationGroup{}, err
	}
	now := s.clock.Now()
	var claimed domain.RegistrationGroup
	err := s.repository.WithinVenueSideTransaction(ctx, func(tx ports.VenueSideTransaction) error {
		match, err := findVenueMatch(ctx, tx, matchID)
		if err != nil {
			return err
		}
		if match.Status != domain.MatchRegistering || !match.RegistrationOpenAt(now) {
			return sharederror.New(sharederror.KindConflict, "当前不在报名时间内")
		}
		sides, err := loadVenueSides(ctx, tx, matchID)
		if err != nil {
			return err
		}
		for _, side := range sides {
			if side.Group.TeamID != nil && *side.Group.TeamID == teamID {
				return sharederror.New(sharederror.KindConflict, "你的球队已经占了一边")
			}
		}
		open, found := domain.SelectVenueClaimableSide(sides)
		if !found {
			return sharederror.New(sharederror.KindConflict, "暂无可占的位置")
		}
		open.Cancel(now)
		if err := tx.UpdateGroup(ctx, open); err != nil {
			return sharederror.Wrap(sharederror.KindInternal, "更新报名组失败", err)
		}
		claimed = domain.NewVenueTeamGroup(matchID, *open.Side, teamID, now)
		if err := tx.CreateGroup(ctx, claimed); err != nil {
			return sharederror.Wrap(sharederror.KindInternal, "占边失败", err)
		}
		return refreshVenueOpponent(ctx, tx, &match, now)
	})
	return claimed, err
}

// Withdraw 占边球队的队长或领队主动退出。
func (s VenueSideService) Withdraw(ctx context.Context, actor sharedauth.Actor, matchID, groupID uuid.UUID) error {
	if !actor.IsUser() {
		return sharederror.ErrForbidden
	}
	_, _, err := s.release(ctx, matchID, groupID, func(_ domain.Match, group domain.RegistrationGroup) error {
		return s.teams.EnsureManager(ctx, *group.TeamID, actor.ID)
	})
	return err
}

// Remove 发布比赛的场馆把球队移出，并通知该队队长、领队和已报名队员。
func (s VenueSideService) Remove(ctx context.Context, actor sharedauth.Actor, matchID, groupID uuid.UUID) error {
	if !actor.IsUser() {
		return sharederror.ErrForbidden
	}
	match, recipients, err := s.release(ctx, matchID, groupID, func(match domain.Match, _ domain.RegistrationGroup) error {
		if match.CreatedByUserID == nil || *match.CreatedByUserID != actor.ID {
			return sharederror.ErrForbidden
		}
		return nil
	})
	if err != nil {
		return err
	}
	for _, userID := range recipients {
		if err := s.notifier.NotifyVenueTeamRemoved(ctx, userID, match.ID, match.Name); err != nil {
			log.Printf("match: 发送场馆移出通知失败 match=%s user=%d: %v", match.ID, userID, err)
		}
	}
	return nil
}

// release 取消球队组并重新开放这一边；比赛开始后不能再变动，避免到场才发现少一边。
// 队员报名随组失效：线下结算不涉及退款。
func (s VenueSideService) release(ctx context.Context, matchID, groupID uuid.UUID, authorize func(domain.Match, domain.RegistrationGroup) error) (domain.Match, []int64, error) {
	if matchID == uuid.Nil || groupID == uuid.Nil {
		return domain.Match{}, nil, sharederror.New(sharederror.KindValidation, "比赛或报名组无效")
	}
	now := s.clock.Now()
	var released domain.Match
	var recipients []int64
	err := s.repository.WithinVenueSideTransaction(ctx, func(tx ports.VenueSideTransaction) error {
		match, err := findVenueMatch(ctx, tx, matchID)
		if err != nil {
			return err
		}
		groups, err := tx.ListActiveGroupsForUpdate(ctx, matchID)
		if err != nil {
			return sharederror.Wrap(sharederror.KindInternal, "查询报名组失败", err)
		}
		var group *domain.RegistrationGroup
		for index := range groups {
			if groups[index].ID == groupID && groups[index].Side != nil && groups[index].TeamID != nil {
				group = &groups[index]
				break
			}
		}
		if group == nil {
			return sharederror.New(sharederror.KindNotFound, "占边球队不存在")
		}
		if err := authorize(match, *group); err != nil {
			return err
		}
		if match.Status != domain.MatchRegistering || !now.Before(match.StartTime) {
			return sharederror.New(sharederror.KindConflict, "比赛开始后不能退出或移出球队")
		}
		limits, err := s.defaultLimits.Resolve(ctx, match.PlayersPerTeam)
		if err != nil {
			return err
		}
		reopened, err := domain.NewVenueOpenGroup(matchID, *group.Side, limits, now)
		if err != nil {
			return err
		}
		recipients, err = tx.ListRemovalRecipients(ctx, *group.TeamID, group.ID)
		if err != nil {
			return sharederror.Wrap(sharederror.KindInternal, "查询球队成员失败", err)
		}
		group.Cancel(now)
		if err := tx.UpdateGroup(ctx, *group); err != nil {
			return sharederror.Wrap(sharederror.KindInternal, "取消球队报名组失败", err)
		}
		if err := tx.CreateGroup(ctx, reopened); err != nil {
			return sharederror.Wrap(sharederror.KindInternal, "重新开放报名失败", err)
		}
		if err := refreshVenueOpponent(ctx, tx, &match, now); err != nil {
			return err
		}
		released = match
		return nil
	})
	return released, recipients, err
}

func findVenueMatch(ctx context.Context, tx ports.VenueSideTransaction, matchID uuid.UUID) (domain.Match, error) {
	match, found, err := tx.FindMatchForUpdate(ctx, matchID)
	if err != nil {
		return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "查询比赛失败", err)
	}
	if !found {
		return domain.Match{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	if match.PublicationMode != domain.VenueHosted {
		return domain.Match{}, sharederror.New(sharederror.KindConflict, "当前比赛不是场馆组局")
	}
	return match, nil
}

// venueSideReader 是占边与报名事务共用的读取能力。
type venueSideReader interface {
	ListActiveGroupsForUpdate(context.Context, uuid.UUID) ([]domain.RegistrationGroup, error)
	CountAttendingForGroup(context.Context, uuid.UUID) (int, error)
}

func loadVenueSides(ctx context.Context, tx venueSideReader, matchID uuid.UUID) ([]domain.VenueSideState, error) {
	groups, err := tx.ListActiveGroupsForUpdate(ctx, matchID)
	if err != nil {
		return nil, sharederror.Wrap(sharederror.KindInternal, "查询报名组失败", err)
	}
	sides := make([]domain.VenueSideState, 0, len(groups))
	for _, group := range groups {
		attending, err := tx.CountAttendingForGroup(ctx, group.ID)
		if err != nil {
			return nil, sharederror.Wrap(sharederror.KindInternal, "统计报名人数失败", err)
		}
		sides = append(sides, domain.VenueSideState{Group: group, Attending: attending})
	}
	return sides, nil
}

func refreshVenueOpponent(ctx context.Context, tx ports.VenueSideTransaction, match *domain.Match, now time.Time) error {
	sides, err := loadVenueSides(ctx, tx, match.ID)
	if err != nil {
		return err
	}
	if err := match.RecalculateVenueOpponent(domain.VenueSidesReady(sides, match.PlayersPerTeam), now); err != nil {
		return err
	}
	if err := tx.UpdateMatchOpponent(ctx, *match); err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "更新比赛状态失败", err)
	}
	return nil
}
