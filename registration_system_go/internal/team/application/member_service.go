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

const memberCandidateLimit = 50

type MemberService struct {
	repository ports.MemberRepository
}

type MemberManagementResult struct {
	Team    domain.Team
	Members []domain.MemberDetails
}

func NewMemberService(repository ports.MemberRepository) MemberService {
	return MemberService{repository: repository}
}

func (s MemberService) List(ctx context.Context, actor sharedauth.Actor, teamID int64) (MemberManagementResult, error) {
	if !actor.IsAdmin() {
		return MemberManagementResult{}, sharederror.ErrForbidden
	}
	return s.load(ctx, teamID)
}

func (s MemberService) ListCandidates(ctx context.Context, actor sharedauth.Actor, teamID int64, search string) ([]domain.MemberCandidate, error) {
	if !actor.IsAdmin() {
		return nil, sharederror.ErrForbidden
	}
	if _, err := s.findTeam(ctx, teamID); err != nil {
		return nil, err
	}
	items, err := s.repository.ListMemberCandidates(ctx, teamID, strings.TrimSpace(search), memberCandidateLimit)
	if err != nil {
		return nil, sharederror.Wrap(sharederror.KindInternal, "查询可添加球员失败", err)
	}
	return items, nil
}

func (s MemberService) Add(ctx context.Context, actor sharedauth.Actor, teamID, userID int64, role domain.Role) (MemberManagementResult, error) {
	if !actor.IsAdmin() {
		return MemberManagementResult{}, sharederror.ErrForbidden
	}
	if userID <= 0 || !role.CanAssignDirectly() {
		return MemberManagementResult{}, sharederror.New(sharederror.KindValidation, "成员用户或角色无效，队长请通过设置队长操作指定")
	}
	if _, err := s.findTeam(ctx, teamID); err != nil {
		return MemberManagementResult{}, err
	}
	if err := s.repository.AddMember(ctx, teamID, userID, role); err != nil {
		switch {
		case errors.Is(err, ports.ErrMemberAlreadyExists):
			return MemberManagementResult{}, sharederror.New(sharederror.KindConflict, "该用户已经是球队成员")
		case errors.Is(err, ports.ErrUserNotFound):
			return MemberManagementResult{}, sharederror.New(sharederror.KindNotFound, "用户不存在")
		default:
			return MemberManagementResult{}, sharederror.Wrap(sharederror.KindInternal, "添加球队成员失败", err)
		}
	}
	return s.load(ctx, teamID)
}

func (s MemberService) Update(ctx context.Context, actor sharedauth.Actor, teamID, userID int64, role domain.Role, status domain.MemberStatus) (MemberManagementResult, error) {
	if !actor.IsAdmin() {
		return MemberManagementResult{}, sharederror.ErrForbidden
	}
	if userID <= 0 || !role.CanAssignDirectly() || !status.IsValid() {
		return MemberManagementResult{}, sharederror.New(sharederror.KindValidation, "成员角色或状态无效，队长请通过设置队长操作指定")
	}
	team, err := s.findTeam(ctx, teamID)
	if err != nil {
		return MemberManagementResult{}, err
	}
	if team.CaptainID != nil && *team.CaptainID == userID {
		return MemberManagementResult{}, sharederror.New(sharederror.KindConflict, "当前队长不能直接修改，请先取消或更换队长")
	}
	updated, err := s.repository.UpdateMember(ctx, teamID, userID, role, status)
	if err != nil {
		return MemberManagementResult{}, sharederror.Wrap(sharederror.KindInternal, "更新球队成员失败", err)
	}
	if !updated {
		return MemberManagementResult{}, sharederror.New(sharederror.KindNotFound, "球队成员不存在")
	}
	return s.load(ctx, teamID)
}

func (s MemberService) Remove(ctx context.Context, actor sharedauth.Actor, teamID, userID int64) (MemberManagementResult, error) {
	if !actor.IsAdmin() {
		return MemberManagementResult{}, sharederror.ErrForbidden
	}
	team, err := s.findTeam(ctx, teamID)
	if err != nil {
		return MemberManagementResult{}, err
	}
	if team.CaptainID != nil && *team.CaptainID == userID {
		return MemberManagementResult{}, sharederror.New(sharederror.KindConflict, "当前队长不能移除，请先取消或更换队长")
	}
	removed, err := s.repository.RemoveMember(ctx, teamID, userID)
	if err != nil {
		return MemberManagementResult{}, sharederror.Wrap(sharederror.KindInternal, "移除球队成员失败", err)
	}
	if !removed {
		return MemberManagementResult{}, sharederror.New(sharederror.KindNotFound, "球队成员不存在")
	}
	return s.load(ctx, teamID)
}

func (s MemberService) SetCaptain(ctx context.Context, actor sharedauth.Actor, teamID int64, userID *int64) (MemberManagementResult, error) {
	if !actor.IsAdmin() {
		return MemberManagementResult{}, sharederror.ErrForbidden
	}
	if userID != nil && *userID <= 0 {
		return MemberManagementResult{}, sharederror.New(sharederror.KindValidation, "队长用户无效")
	}
	if _, err := s.findTeam(ctx, teamID); err != nil {
		return MemberManagementResult{}, err
	}
	if err := s.repository.SetCaptain(ctx, teamID, userID); err != nil {
		if errors.Is(err, ports.ErrMemberNotFound) {
			return MemberManagementResult{}, sharederror.New(sharederror.KindValidation, "队长必须是启用中的球队成员")
		}
		return MemberManagementResult{}, sharederror.Wrap(sharederror.KindInternal, "设置球队队长失败", err)
	}
	return s.load(ctx, teamID)
}

func (s MemberService) load(ctx context.Context, teamID int64) (MemberManagementResult, error) {
	team, err := s.findTeam(ctx, teamID)
	if err != nil {
		return MemberManagementResult{}, err
	}
	members, err := s.repository.ListMembers(ctx, teamID)
	if err != nil {
		return MemberManagementResult{}, sharederror.Wrap(sharederror.KindInternal, "查询球队成员失败", err)
	}
	return MemberManagementResult{Team: team, Members: members}, nil
}

func (s MemberService) findTeam(ctx context.Context, teamID int64) (domain.Team, error) {
	team, found, err := s.repository.FindByID(ctx, teamID)
	if err != nil {
		return domain.Team{}, sharederror.Wrap(sharederror.KindInternal, "查询球队失败", err)
	}
	if !found {
		return domain.Team{}, sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	return team, nil
}
