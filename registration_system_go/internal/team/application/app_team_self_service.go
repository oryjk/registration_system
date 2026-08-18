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

// AppTeamSelfService 承载小程序无球队用户的自服务：创建球队、加入球队、搜索球队与入队口令查询。
// 行为口径对齐旧 Rust 后端（join_team / create_team / search_teams / password-info）。
type AppTeamSelfService struct {
	repository ports.AppTeamSelfRepository
	hasher     ports.TeamPasswordHasher
}

func NewAppTeamSelfService(repository ports.AppTeamSelfRepository, hasher ports.TeamPasswordHasher) AppTeamSelfService {
	return AppTeamSelfService{repository: repository, hasher: hasher}
}

// CreateTeam 用户创建球队：创建者自动成为队长（captain 成员 + teams.captain_id）。
// joinPassword 为空串或 nil 表示不设入队口令。
func (s AppTeamSelfService) CreateTeam(ctx context.Context, actor sharedauth.Actor, name string, description *string, joinPassword *string) (domain.Team, error) {
	if actor.ID <= 0 {
		return domain.Team{}, sharederror.ErrForbidden
	}
	team, err := domain.NewTeam(name, description)
	if err != nil {
		return domain.Team{}, err
	}
	exists, err := s.repository.TeamNameExists(ctx, team.Name)
	if err != nil {
		return domain.Team{}, sharederror.Wrap(sharederror.KindInternal, "检查球队名称失败", err)
	}
	if exists {
		return domain.Team{}, sharederror.New(sharederror.KindConflict, "球队名称已存在")
	}
	var joinPasswordHash *string
	if joinPassword != nil && strings.TrimSpace(*joinPassword) != "" {
		hash, err := s.hasher.Hash(*joinPassword)
		if err != nil {
			return domain.Team{}, sharederror.Wrap(sharederror.KindInternal, "加密入队口令失败", err)
		}
		joinPasswordHash = &hash
	}
	created, err := s.repository.CreateWithCaptain(ctx, team.Name, team.Description, joinPasswordHash, actor.ID)
	if err != nil {
		return domain.Team{}, sharederror.Wrap(sharederror.KindInternal, "创建球队失败", err)
	}
	return created, nil
}

// JoinTeam 用户加入球队：校验球队状态、成员关系与入队口令；
// 历史 inactive 成员直接恢复为 active 普通队员。
func (s AppTeamSelfService) JoinTeam(ctx context.Context, actor sharedauth.Actor, teamID int64, password *string) error {
	if actor.ID <= 0 {
		return sharederror.ErrForbidden
	}
	if teamID <= 0 {
		return sharederror.New(sharederror.KindValidation, "球队 ID 无效")
	}
	hash, found, err := s.repository.FindJoinPasswordHash(ctx, teamID)
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "查询球队失败", err)
	}
	if !found {
		return sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	team, found, err := s.repository.FindByID(ctx, teamID)
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "查询球队失败", err)
	}
	if !found {
		return sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	if team.Status != domain.TeamActive {
		return sharederror.New(sharederror.KindValidation, "球队已冻结，不可加入")
	}
	member, memberFound, err := s.repository.FindMembership(ctx, teamID, actor.ID)
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "检查球队成员关系失败", err)
	}
	if memberFound && member.Status == domain.MemberActive {
		return sharederror.New(sharederror.KindConflict, "您已经是该球队成员")
	}
	if hash != nil {
		raw := ""
		if password != nil {
			raw = *password
		}
		if !s.hasher.Verify(*hash, raw) {
			return sharederror.New(sharederror.KindValidation, "加入密码错误")
		}
	}
	if memberFound {
		reactivated, err := s.repository.ReactivateMember(ctx, teamID, actor.ID)
		if err != nil {
			return sharederror.Wrap(sharederror.KindInternal, "重新加入球队失败", err)
		}
		if reactivated {
			return nil
		}
	}
	if err := s.repository.AddMember(ctx, teamID, actor.ID, domain.RoleMember); err != nil {
		if errors.Is(err, ports.ErrMemberAlreadyExists) {
			return sharederror.New(sharederror.KindConflict, "您已经是该球队成员")
		}
		return sharederror.Wrap(sharederror.KindInternal, "加入球队失败", err)
	}
	return nil
}

// SearchTeams 按关键字搜索可加入的球队（仅 active），附当前成员数。
func (s AppTeamSelfService) SearchTeams(ctx context.Context, keyword string) ([]ports.AppTeamSummary, error) {
	items, err := s.repository.SearchByKeyword(ctx, strings.TrimSpace(keyword))
	if err != nil {
		return nil, sharederror.Wrap(sharederror.KindInternal, "搜索球队失败", err)
	}
	return items, nil
}

// RequiresJoinPassword 返回球队是否设置了入队口令；球队不存在返回 404。
func (s AppTeamSelfService) RequiresJoinPassword(ctx context.Context, teamID int64) (bool, error) {
	if teamID <= 0 {
		return false, sharederror.New(sharederror.KindValidation, "球队 ID 无效")
	}
	hash, found, err := s.repository.FindJoinPasswordHash(ctx, teamID)
	if err != nil {
		return false, sharederror.Wrap(sharederror.KindInternal, "查询球队口令信息失败", err)
	}
	if !found {
		return false, sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	return hash != nil, nil
}
