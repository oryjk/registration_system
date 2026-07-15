package application

import (
	"context"
	"errors"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/ports"
)

type QueryService struct {
	repository ports.Repository
}

func NewQueryService(repository ports.Repository) QueryService {
	return QueryService{repository: repository}
}

func (s QueryService) EnsureManager(ctx context.Context, teamID, userID int64) error {
	member, found, err := s.repository.FindActiveMember(ctx, teamID, userID)
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "查询球队权限失败", err)
	}
	if !found || !member.CanManageMatches() {
		return sharederror.ErrForbidden
	}
	return nil
}

func (s QueryService) FindTeam(ctx context.Context, teamID int64) (domain.Team, error) {
	team, found, err := s.repository.FindByID(ctx, teamID)
	if err != nil {
		return domain.Team{}, sharederror.Wrap(sharederror.KindInternal, "查询球队失败", err)
	}
	if !found {
		return domain.Team{}, sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	return team, nil
}

func (s QueryService) EnsureExists(ctx context.Context, teamID int64) error {
	_, err := s.FindTeam(ctx, teamID)
	return err
}

func (s QueryService) ListByUser(ctx context.Context, userID int64) ([]domain.TeamMembership, error) {
	items, err := s.repository.ListByUser(ctx, userID)
	if err != nil {
		return nil, sharederror.Wrap(sharederror.KindInternal, "查询用户球队失败", err)
	}
	return items, nil
}

func (s QueryService) ListActive(ctx context.Context) ([]domain.Team, error) {
	status := domain.TeamActive
	items, err := s.repository.List(ctx, &status)
	if err != nil {
		return nil, sharederror.Wrap(sharederror.KindInternal, "查询球队列表失败", err)
	}
	return items, nil
}

func (s QueryService) ListTeams(ctx context.Context, actor sharedauth.Actor, status *domain.TeamStatus) ([]domain.Team, error) {
	if !actor.IsAdmin() {
		return nil, sharederror.ErrForbidden
	}
	if status != nil && !status.IsValid() {
		return nil, sharederror.New(sharederror.KindValidation, "球队状态无效")
	}
	items, err := s.repository.List(ctx, status)
	if err != nil {
		return nil, sharederror.Wrap(sharederror.KindInternal, "查询球队列表失败", err)
	}
	return items, nil
}

func (s QueryService) GetTeam(ctx context.Context, actor sharedauth.Actor, teamID int64) (domain.Team, error) {
	if !actor.IsAdmin() {
		return domain.Team{}, sharederror.ErrForbidden
	}
	return s.FindTeam(ctx, teamID)
}

func (s QueryService) CreateTeam(ctx context.Context, actor sharedauth.Actor, name string, description *string) (domain.Team, error) {
	if !actor.IsAdmin() {
		return domain.Team{}, sharederror.ErrForbidden
	}
	team, err := domain.NewTeam(name, description)
	if err != nil {
		return domain.Team{}, err
	}
	created, err := s.repository.Create(ctx, team)
	if err != nil {
		return domain.Team{}, sharederror.Wrap(sharederror.KindInternal, "创建球队失败", err)
	}
	return created, nil
}

func (s QueryService) UpdateTeam(ctx context.Context, actor sharedauth.Actor, teamID int64, name string, description *string, status domain.TeamStatus) (domain.Team, error) {
	if !actor.IsAdmin() {
		return domain.Team{}, sharederror.ErrForbidden
	}
	team, err := s.FindTeam(ctx, teamID)
	if err != nil {
		return domain.Team{}, err
	}
	team, err = team.Update(name, description, status)
	if err != nil {
		return domain.Team{}, err
	}
	updated, err := s.repository.Update(ctx, team)
	if err != nil {
		return domain.Team{}, sharederror.Wrap(sharederror.KindInternal, "更新球队失败", err)
	}
	return updated, nil
}

func (s QueryService) DeleteTeam(ctx context.Context, actor sharedauth.Actor, teamID int64) error {
	if !actor.IsAdmin() {
		return sharederror.ErrForbidden
	}
	deleted, err := s.repository.Delete(ctx, teamID)
	if errors.Is(err, sharederror.ErrConflict) {
		return sharederror.New(sharederror.KindConflict, "球队已被比赛或申请使用，不能删除")
	}
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "删除球队失败", err)
	}
	if !deleted {
		return sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	return nil
}
