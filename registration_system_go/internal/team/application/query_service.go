package application

import (
	"context"
	"errors"
	"strings"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/ports"
)

type QueryService struct {
	repository ports.Repository
	hasher     ports.TeamPasswordHasher
}

func NewQueryService(repository ports.Repository, hasher ports.TeamPasswordHasher) QueryService {
	return QueryService{repository: repository, hasher: hasher}
}

// UpdateJoinPassword 管理员代为更新入队口令：joinPassword trim 后非空=设置/替换，空串=清除（开放加入）。
// 口令语义与用户建队一致：TrimSpace 仅用于判空，哈希保留原始值。
func (s QueryService) UpdateJoinPassword(ctx context.Context, actor sharedauth.Actor, teamID int64, joinPassword string) error {
	if !actor.IsAdmin() {
		return sharederror.ErrForbidden
	}
	var hash *string
	if strings.TrimSpace(joinPassword) != "" {
		hashed, err := s.hasher.Hash(joinPassword)
		if err != nil {
			return sharederror.Wrap(sharederror.KindInternal, "加密入队口令失败", err)
		}
		hash = &hashed
	}
	found, err := s.repository.UpdateJoinPasswordHash(ctx, teamID, hash)
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "更新入队密码失败", err)
	}
	if !found {
		return sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	return nil
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

func (s QueryService) EnsureCaptain(ctx context.Context, teamID, userID int64) error {
	member, found, err := s.repository.FindActiveMember(ctx, teamID, userID)
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "查询球队权限失败", err)
	}
	if !found || !member.IsCaptain() {
		return sharederror.ErrForbidden
	}
	return nil
}

// EnsureMember 校验用户是该队成员（不限状态），离队成员的历史数据仍可被管理端查询。
func (s QueryService) EnsureMember(ctx context.Context, teamID, userID int64) error {
	_, found, err := s.repository.FindMembership(ctx, teamID, userID)
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "查询球队成员失败", err)
	}
	if !found {
		return sharederror.ErrForbidden
	}
	return nil
}

func (s QueryService) EnsureActiveMember(ctx context.Context, teamID, userID int64) error {
	found, err := s.IsActiveMember(ctx, teamID, userID)
	if err != nil {
		return err
	}
	if !found {
		return sharederror.ErrForbidden
	}
	return nil
}

func (s QueryService) IsActiveMember(ctx context.Context, teamID, userID int64) (bool, error) {
	member, found, err := s.repository.FindActiveMember(ctx, teamID, userID)
	if err != nil {
		return false, sharederror.Wrap(sharederror.KindInternal, "查询球队成员身份失败", err)
	}
	return found && member.Status == domain.MemberActive, nil
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

func (s QueryService) EnsureActive(ctx context.Context, teamID int64) error {
	team, err := s.FindTeam(ctx, teamID)
	if err != nil {
		return err
	}
	if team.Status != domain.TeamActive {
		return sharederror.New(sharederror.KindConflict, "球队已冻结，不能参与比赛")
	}
	return nil
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
