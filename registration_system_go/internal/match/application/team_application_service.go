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

type TeamApplicationService struct {
	repository ports.TeamApplicationRepository
	teams      ports.TeamAccess
	clock      ports.Clock
}

func NewTeamApplicationService(repository ports.TeamApplicationRepository, teams ports.TeamAccess, clock ports.Clock) TeamApplicationService {
	return TeamApplicationService{repository: repository, teams: teams, clock: clock}
}

func (s TeamApplicationService) List(ctx context.Context, actor sharedauth.Actor, matchID uuid.UUID) ([]ports.TeamApplicationItem, error) {
	match, err := s.findMatch(ctx, matchID)
	if err != nil {
		return nil, err
	}
	if actor.IsAdmin() {
		return s.list(ctx, matchID)
	}
	if !actor.IsUser() {
		return nil, sharederror.ErrForbidden
	}
	if err := s.teams.EnsureManager(ctx, match.HostTeamID, actor.ID); err == nil {
		return s.list(ctx, matchID)
	} else if !errors.Is(err, sharederror.ErrForbidden) {
		return nil, err
	}
	items, err := s.repository.ListApplicationsForManager(ctx, matchID, actor.ID)
	if err != nil {
		return nil, wrapTeamApplicationStoreError("查询球队申请失败", err)
	}
	return items, nil
}

func (s TeamApplicationService) Apply(ctx context.Context, actor sharedauth.Actor, matchID uuid.UUID, applicantTeamID int64, introduction string) (domain.TeamApplication, error) {
	if !actor.IsUser() {
		return domain.TeamApplication{}, sharederror.ErrForbidden
	}
	if err := s.teams.EnsureActive(ctx, applicantTeamID); err != nil {
		return domain.TeamApplication{}, err
	}
	if err := s.teams.EnsureManager(ctx, applicantTeamID, actor.ID); err != nil {
		return domain.TeamApplication{}, err
	}
	now := s.clock.Now()
	var created domain.TeamApplication
	err := s.repository.WithinTeamApplicationTransaction(ctx, func(tx ports.TeamApplicationTransaction) error {
		match, found, err := tx.FindMatch(ctx, matchID)
		if err != nil {
			return wrapTeamApplicationStoreError("查询比赛失败", err)
		}
		if !found {
			return sharederror.New(sharederror.KindNotFound, "比赛不存在")
		}
		if err := ensureRecruitingTeamMatch(match); err != nil {
			return err
		}
		if !match.RegistrationOpenAt(now) {
			return sharederror.New(sharederror.KindConflict, "当前不在报名时间内")
		}
		if applicantTeamID == match.HostTeamID {
			return sharederror.New(sharederror.KindValidation, "主队不能申请成为自己的对手")
		}
		created, err = domain.NewTeamApplication(matchID, applicantTeamID, actor.ID, introduction, now)
		if err != nil {
			return err
		}
		if err := tx.CreateApplication(ctx, created); err != nil {
			if errors.Is(err, ports.ErrActiveTeamApplication) {
				return sharederror.New(sharederror.KindConflict, "该球队已经提交过有效申请")
			}
			return wrapTeamApplicationStoreError("提交球队申请失败", err)
		}
		return nil
	})
	return created, err
}

func (s TeamApplicationService) Select(ctx context.Context, actor sharedauth.Actor, matchID, applicationID uuid.UUID) (domain.TeamApplication, error) {
	match, err := s.findMatch(ctx, matchID)
	if err != nil {
		return domain.TeamApplication{}, err
	}
	if err := s.ensureHostManager(ctx, actor, match.HostTeamID); err != nil {
		return domain.TeamApplication{}, err
	}
	now := s.clock.Now()
	var selected domain.TeamApplication
	err = s.repository.WithinTeamApplicationTransaction(ctx, func(tx ports.TeamApplicationTransaction) error {
		lockedMatch, application, err := loadTeamApplicationMutation(ctx, tx, matchID, applicationID)
		if err != nil {
			return err
		}
		if err := ensureRecruitingTeamMatch(lockedMatch); err != nil {
			return err
		}
		if err := s.teams.EnsureActive(ctx, application.ApplicantTeamID); err != nil {
			return err
		}
		if err := application.Select(now); err != nil {
			return err
		}
		if err := lockedMatch.ConfirmTeamOpponent(application.ApplicantTeamID, now); err != nil {
			return err
		}
		pending, err := tx.ListPendingApplications(ctx, matchID)
		if err != nil {
			return wrapTeamApplicationStoreError("查询待选择球队失败", err)
		}
		for _, other := range pending {
			if other.ID == application.ID {
				continue
			}
			if err := other.Reject(now); err != nil {
				return err
			}
			if err := tx.UpdateApplication(ctx, other); err != nil {
				return wrapTeamApplicationStoreError("拒绝其他球队申请失败", err)
			}
		}
		guestGroup := domain.NewTeamGroup(matchID, domain.GroupGuestTeam, application.ApplicantTeamID, nil, now)
		if err := tx.UpdateApplication(ctx, application); err != nil {
			return wrapTeamApplicationStoreError("选择球队申请失败", err)
		}
		if err := tx.CreateGroup(ctx, guestGroup); err != nil {
			return wrapTeamApplicationStoreError("创建客队报名组失败", err)
		}
		if err := tx.UpdateMatchOpponent(ctx, lockedMatch); err != nil {
			return wrapTeamApplicationStoreError("更新比赛对手失败", err)
		}
		selected = application
		return nil
	})
	return selected, err
}

func (s TeamApplicationService) Withdraw(ctx context.Context, actor sharedauth.Actor, matchID, applicationID uuid.UUID) (domain.TeamApplication, error) {
	if !actor.IsUser() && !actor.IsAdmin() {
		return domain.TeamApplication{}, sharederror.ErrForbidden
	}
	now := s.clock.Now()
	var withdrawn domain.TeamApplication
	err := s.repository.WithinTeamApplicationTransaction(ctx, func(tx ports.TeamApplicationTransaction) error {
		match, application, err := loadTeamApplicationMutation(ctx, tx, matchID, applicationID)
		if err != nil {
			return err
		}
		if match.Status != domain.MatchRegistering || match.PublicationMode != domain.OnlineTeam {
			return sharederror.New(sharederror.KindConflict, "当前比赛不能撤回球队申请")
		}
		wasSelected := application.Status == domain.ApplicationSelected
		switch application.Status {
		case domain.ApplicationPending:
			if !match.RegistrationOpenAt(now) {
				return sharederror.New(sharederror.KindConflict, "当前不在报名时间内")
			}
			if actor.IsAdmin() {
				return sharederror.ErrForbidden
			}
			if err := s.teams.EnsureManager(ctx, application.ApplicantTeamID, actor.ID); err != nil {
				return err
			}
		case domain.ApplicationSelected:
			if err := s.ensureSelectedWithdrawalPermission(ctx, actor, match, application); err != nil {
				return err
			}
		default:
			return sharederror.New(sharederror.KindConflict, "当前球队申请不能撤回")
		}
		if err := application.Withdraw(now); err != nil {
			return err
		}
		if err := tx.UpdateApplication(ctx, application); err != nil {
			return wrapTeamApplicationStoreError("撤回球队申请失败", err)
		}
		if wasSelected {
			if match.AwayTeamID == nil || *match.AwayTeamID != application.ApplicantTeamID || match.OpponentState != domain.OpponentConfirmed {
				return sharederror.New(sharederror.KindConflict, "比赛对手状态与已选申请不一致")
			}
			group, found, err := tx.FindActiveGuestGroup(ctx, matchID)
			if err != nil {
				return wrapTeamApplicationStoreError("查询客队报名组失败", err)
			}
			if !found || group.TeamID == nil || *group.TeamID != application.ApplicantTeamID {
				return sharederror.New(sharederror.KindConflict, "比赛客队报名组状态不一致")
			}
			if err := match.ReopenTeamRecruitment(now); err != nil {
				return err
			}
			group.Cancel(now)
			if err := tx.UpdateGroup(ctx, group); err != nil {
				return wrapTeamApplicationStoreError("取消客队报名组失败", err)
			}
			if err := tx.UpdateMatchOpponent(ctx, match); err != nil {
				return wrapTeamApplicationStoreError("重开球队招募失败", err)
			}
		}
		withdrawn = application
		return nil
	})
	return withdrawn, err
}

func (s TeamApplicationService) findMatch(ctx context.Context, matchID uuid.UUID) (domain.Match, error) {
	match, found, err := s.repository.FindMatch(ctx, matchID)
	if err != nil {
		return domain.Match{}, wrapTeamApplicationStoreError("查询比赛失败", err)
	}
	if !found {
		return domain.Match{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	return match, nil
}

func (s TeamApplicationService) list(ctx context.Context, matchID uuid.UUID) ([]ports.TeamApplicationItem, error) {
	items, err := s.repository.ListApplications(ctx, matchID)
	if err != nil {
		return nil, wrapTeamApplicationStoreError("查询球队申请失败", err)
	}
	return items, nil
}

func (s TeamApplicationService) ensureHostManager(ctx context.Context, actor sharedauth.Actor, hostTeamID int64) error {
	if actor.IsAdmin() {
		return nil
	}
	if !actor.IsUser() {
		return sharederror.ErrForbidden
	}
	return s.teams.EnsureManager(ctx, hostTeamID, actor.ID)
}

func (s TeamApplicationService) ensureSelectedWithdrawalPermission(ctx context.Context, actor sharedauth.Actor, match domain.Match, application domain.TeamApplication) error {
	if actor.IsAdmin() {
		return nil
	}
	if err := s.teams.EnsureManager(ctx, application.ApplicantTeamID, actor.ID); err == nil {
		return nil
	} else if !errors.Is(err, sharederror.ErrForbidden) {
		return err
	}
	return s.teams.EnsureManager(ctx, match.HostTeamID, actor.ID)
}

func ensureRecruitingTeamMatch(match domain.Match) error {
	if match.Status != domain.MatchRegistering || match.PublicationMode != domain.OnlineTeam || match.OpponentState != domain.OpponentRecruiting || match.AwayTeamID != nil {
		return sharederror.New(sharederror.KindConflict, "当前比赛不在球队招募中")
	}
	return nil
}

func loadTeamApplicationMutation(ctx context.Context, tx ports.TeamApplicationTransaction, matchID, applicationID uuid.UUID) (domain.Match, domain.TeamApplication, error) {
	match, found, err := tx.FindMatch(ctx, matchID)
	if err != nil {
		return domain.Match{}, domain.TeamApplication{}, wrapTeamApplicationStoreError("查询比赛失败", err)
	}
	if !found {
		return domain.Match{}, domain.TeamApplication{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	application, found, err := tx.FindApplication(ctx, matchID, applicationID)
	if err != nil {
		return domain.Match{}, domain.TeamApplication{}, wrapTeamApplicationStoreError("查询球队申请失败", err)
	}
	if !found {
		return domain.Match{}, domain.TeamApplication{}, sharederror.New(sharederror.KindNotFound, "球队申请不存在")
	}
	return match, application, nil
}

func wrapTeamApplicationStoreError(message string, err error) error {
	var typed *sharederror.Error
	if errors.As(err, &typed) {
		return err
	}
	return sharederror.Wrap(sharederror.KindInternal, message, err)
}
