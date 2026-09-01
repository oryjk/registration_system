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

// AppManageService 承载小程序侧队长/领队的球队管理写操作。
// 鉴权规则：操作者必须是该球队 active 的队长或领队（Member.CanManageTeam），管理员身份不适用。
type AppManageService struct {
	repository ports.AppManageRepository
	hasher     ports.TeamPasswordHasher
	// logos 保存球队 Logo（本地目录或 MinIO）；为 nil 表示上传未配置。
	logos TeamLogoStore
}

func NewAppManageService(repository ports.AppManageRepository, hasher ports.TeamPasswordHasher, logos TeamLogoStore) AppManageService {
	return AppManageService{repository: repository, hasher: hasher, logos: logos}
}

// TeamLogoStore 保存球队 Logo 并返回对外 URL，由 adapters/logostore 实现。
type TeamLogoStore interface {
	SaveTeamLogo(ctx context.Context, teamID int64, extension, contentType string, data []byte) (string, error)
}

// UploadTeamLogo 队长/领队上传球队 Logo：保存文件后把 URL 写回球队资料。
func (s AppManageService) UploadTeamLogo(ctx context.Context, actor sharedauth.Actor, teamID int64, extension, contentType string, data []byte) (string, error) {
	if _, err := s.authorizeManager(ctx, actor, teamID); err != nil {
		return "", err
	}
	if s.logos == nil {
		return "", sharederror.New(sharederror.KindInternal, "Logo 上传未配置")
	}
	url, err := s.logos.SaveTeamLogo(ctx, teamID, extension, contentType, data)
	if err != nil {
		return "", sharederror.Wrap(sharederror.KindInternal, "保存球队 Logo 失败", err)
	}
	if err := s.UpdateProfile(ctx, actor, teamID, nil, nil, &url); err != nil {
		return "", err
	}
	return url, nil
}

// UpdateJoinPassword 更新入队口令：joinPassword trim 后非空=设置/替换，空串=清除（开放加入）。
// 口令语义与建队一致：TrimSpace 仅用于判空，哈希保留原始值。
func (s AppManageService) UpdateJoinPassword(ctx context.Context, actor sharedauth.Actor, teamID int64, joinPassword string) error {
	if _, err := s.authorizeManager(ctx, actor, teamID); err != nil {
		return err
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

// UpdateProfile 更新球队资料：name 传 nil 保持不变，description/logoURL 传 nil 或空串视为清除。
// 不允许修改球队 status（冻结/激活仍是管理员专属）。
func (s AppManageService) UpdateProfile(ctx context.Context, actor sharedauth.Actor, teamID int64, name *string, description, logoURL *string) error {
	team, err := s.authorizeManager(ctx, actor, teamID)
	if err != nil {
		return err
	}
	team, err = team.UpdateProfile(name, description, logoURL)
	if err != nil {
		return err
	}
	if _, err := s.repository.UpdateTeamProfile(ctx, team); err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "更新球队资料失败", err)
	}
	return nil
}

func (s AppManageService) AddMember(ctx context.Context, actor sharedauth.Actor, teamID, userID int64, role domain.Role) error {
	if _, err := s.authorizeManager(ctx, actor, teamID); err != nil {
		return err
	}
	if userID <= 0 || !role.CanAssignDirectly() {
		return sharederror.New(sharederror.KindValidation, "成员用户或角色无效，队长请通过移交队长操作指定")
	}
	active, err := s.repository.ActiveUserExists(ctx, userID)
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "查询用户失败", err)
	}
	if !active {
		return sharederror.New(sharederror.KindNotFound, "用户不存在或已停用")
	}
	if err := s.repository.AddMember(ctx, teamID, userID, role); err != nil {
		switch {
		case errors.Is(err, ports.ErrMemberAlreadyExists):
			return sharederror.New(sharederror.KindConflict, "该用户已经是球队成员")
		case errors.Is(err, ports.ErrUserNotFound):
			return sharederror.New(sharederror.KindNotFound, "用户不存在")
		default:
			return sharederror.Wrap(sharederror.KindInternal, "添加球队成员失败", err)
		}
	}
	return nil
}

// UpdateMember 部分更新成员角色/状态：role 与 status 至少传一个；队长本人不可修改。
func (s AppManageService) UpdateMember(ctx context.Context, actor sharedauth.Actor, teamID, userID int64, role *domain.Role, status *domain.MemberStatus) error {
	team, err := s.authorizeManager(ctx, actor, teamID)
	if err != nil {
		return err
	}
	if userID <= 0 || (role == nil && status == nil) {
		return sharederror.New(sharederror.KindValidation, "成员角色或状态至少传一个")
	}
	if team.CaptainID != nil && *team.CaptainID == userID {
		return sharederror.New(sharederror.KindConflict, "不能修改队长角色，请使用移交队长")
	}
	member, found, err := s.repository.FindMembership(ctx, teamID, userID)
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "查询球队成员失败", err)
	}
	if !found {
		return sharederror.New(sharederror.KindNotFound, "球队成员不存在")
	}
	newRole, newStatus := member.Role, member.Status
	if role != nil {
		if !role.CanAssignDirectly() {
			return sharederror.New(sharederror.KindValidation, "成员角色无效，队长请通过移交队长操作指定")
		}
		newRole = *role
	}
	if status != nil {
		if !status.IsValid() {
			return sharederror.New(sharederror.KindValidation, "成员状态无效")
		}
		newStatus = *status
	}
	updated, err := s.repository.UpdateMember(ctx, teamID, userID, newRole, newStatus)
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "更新球队成员失败", err)
	}
	if !updated {
		return sharederror.New(sharederror.KindNotFound, "球队成员不存在")
	}
	return nil
}

// RemoveMember 移除成员；仓储层会在同一事务内取消其在本队未开始比赛中的报名
// （进行中/已完赛/已取消比赛与已支付报名保留）。
func (s AppManageService) RemoveMember(ctx context.Context, actor sharedauth.Actor, teamID, userID int64) error {
	team, err := s.authorizeManager(ctx, actor, teamID)
	if err != nil {
		return err
	}
	if team.CaptainID != nil && *team.CaptainID == userID {
		return sharederror.New(sharederror.KindConflict, "队长本人不能移除，请先移交队长")
	}
	removed, err := s.repository.RemoveMember(ctx, teamID, userID)
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "移除球队成员失败", err)
	}
	if !removed {
		return sharederror.New(sharederror.KindNotFound, "球队成员不存在")
	}
	return nil
}

// DeleteTeam 解散球队：仅队长本人可操作（领队/副队长不可）。
// 软删除——teams.status 置为 dissolved，保留历史比赛/申请/支付数据的引用；
// 解散前校验进行中的引用：未结束比赛（主/客队）与进行中约队申请，命中则返回 409。
func (s AppManageService) DeleteTeam(ctx context.Context, actor sharedauth.Actor, teamID int64) error {
	if _, err := s.authorizeCaptain(ctx, actor, teamID); err != nil {
		return err
	}
	blockers, err := s.repository.FindDissolveBlockers(ctx, teamID)
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "查询球队引用失败", err)
	}
	if !blockers.IsEmpty() {
		return sharederror.New(sharederror.KindConflict, "球队仍有进行中的比赛或约队申请，需先处理后再解散")
	}
	dissolved, err := s.repository.Dissolve(ctx, teamID)
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "解散球队失败", err)
	}
	if !dissolved {
		return sharederror.New(sharederror.KindConflict, "球队不存在或已解散")
	}
	return nil
}

// DissolveBlockers 查询阻止球队解散的进行中引用，供小程序在确认解散前展示处理入口。
func (s AppManageService) DissolveBlockers(ctx context.Context, actor sharedauth.Actor, teamID int64) (domain.DissolveBlockers, error) {
	if _, err := s.authorizeCaptain(ctx, actor, teamID); err != nil {
		return domain.DissolveBlockers{}, err
	}
	blockers, err := s.repository.FindDissolveBlockers(ctx, teamID)
	if err != nil {
		return domain.DissolveBlockers{}, sharederror.Wrap(sharederror.KindInternal, "查询球队引用失败", err)
	}
	return blockers, nil
}

func (s AppManageService) authorizeManager(ctx context.Context, actor sharedauth.Actor, teamID int64) (domain.Team, error) {
	team, found, err := s.repository.FindByID(ctx, teamID)
	if err != nil {
		return domain.Team{}, sharederror.Wrap(sharederror.KindInternal, "查询球队失败", err)
	}
	if !found {
		return domain.Team{}, sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	// 已解散球队对用户侧管理操作视同不存在。
	if team.Status == domain.TeamDissolved {
		return domain.Team{}, sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	if !actor.IsUser() {
		return domain.Team{}, sharederror.ErrForbidden
	}
	member, found, err := s.repository.FindActiveMember(ctx, teamID, actor.ID)
	if err != nil {
		return domain.Team{}, sharederror.Wrap(sharederror.KindInternal, "查询球队权限失败", err)
	}
	if !found || !member.CanManageTeam() {
		return domain.Team{}, sharederror.ErrForbidden
	}
	return team, nil
}

// authorizeCaptain 在队长/领队管理权限之上再收紧为仅队长本人，用于解散球队等
// 不可逆的收尾动作（与收尾比赛使用 IsCaptain 的规则一致）。
func (s AppManageService) authorizeCaptain(ctx context.Context, actor sharedauth.Actor, teamID int64) (domain.Team, error) {
	team, err := s.authorizeManager(ctx, actor, teamID)
	if err != nil {
		return domain.Team{}, err
	}
	member, found, err := s.repository.FindActiveMember(ctx, teamID, actor.ID)
	if err != nil {
		return domain.Team{}, sharederror.Wrap(sharederror.KindInternal, "查询球队权限失败", err)
	}
	if !found || !member.IsCaptain() {
		return domain.Team{}, sharederror.New(sharederror.KindForbidden, "解散球队仅限队长本人操作")
	}
	return team, nil
}
