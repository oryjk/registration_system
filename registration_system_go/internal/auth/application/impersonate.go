package application

import (
	"context"
	"strings"

	"github.com/oryjk/registration_system/registration_system_go/internal/auth/ports"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	userdomain "github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
	userports "github.com/oryjk/registration_system/registration_system_go/internal/user/ports"
)

// impersonationSearchLimit 目标用户搜索的固定返回条数：调试场景够用即可，不做分页。
const impersonationSearchLimit = 20

// ImpersonationService 身份切换（impersonate）：白名单账号换取任意小程序用户的登录 token，
// 用于复现用户反馈的问题。签出的 token 与正常登录 token 同构。
type ImpersonationService struct {
	users  ports.ImpersonationUserRepository
	tokens ports.TokenService
	// allowedUserIDs 允许发起身份切换的用户白名单（env IMPERSONATION_ALLOWED_USER_IDS）；
	// 为空时接口对所有人关闭。
	allowedUserIDs map[int64]struct{}
}

type ImpersonationResult struct {
	Token string
	User  userdomain.User
}

func NewImpersonationService(users ports.ImpersonationUserRepository, tokens ports.TokenService, allowedUserIDs map[int64]struct{}) *ImpersonationService {
	return &ImpersonationService{users: users, tokens: tokens, allowedUserIDs: allowedUserIDs}
}

// SearchTargets 按昵称/姓名/手机号/用户 ID 模糊搜索可切换的目标用户。
func (s *ImpersonationService) SearchTargets(ctx context.Context, actorID int64, keyword string) ([]userdomain.User, error) {
	if err := s.checkAllowed(actorID); err != nil {
		return nil, err
	}
	users, err := s.users.ListForAdmin(ctx, userports.AdminUserFilter{
		Search: strings.TrimSpace(keyword),
		Limit:  impersonationSearchLimit,
	})
	if err != nil {
		return nil, sharederror.Wrap(sharederror.KindInternal, "查询用户失败", err)
	}
	return users, nil
}

// Impersonate 为白名单账号签发目标用户的登录 token。
func (s *ImpersonationService) Impersonate(ctx context.Context, actorID, targetUserID int64) (ImpersonationResult, error) {
	if err := s.checkAllowed(actorID); err != nil {
		return ImpersonationResult{}, err
	}
	if targetUserID <= 0 {
		return ImpersonationResult{}, sharederror.New(sharederror.KindValidation, "目标用户 ID 无效")
	}
	user, found, err := s.users.FindByID(ctx, targetUserID)
	if err != nil {
		return ImpersonationResult{}, sharederror.Wrap(sharederror.KindInternal, "查询目标用户失败", err)
	}
	if !found {
		return ImpersonationResult{}, sharederror.New(sharederror.KindNotFound, "目标用户不存在")
	}
	if !user.IsActive() {
		return ImpersonationResult{}, sharederror.New(sharederror.KindForbidden, "目标用户已冻结，无法切换")
	}
	token, err := s.tokens.IssueUser(ctx, user.ID)
	if err != nil {
		return ImpersonationResult{}, sharederror.Wrap(sharederror.KindInternal, "签发身份切换凭证失败", err)
	}
	return ImpersonationResult{Token: token, User: user}, nil
}

func (s *ImpersonationService) checkAllowed(actorID int64) error {
	if _, allowed := s.allowedUserIDs[actorID]; !allowed {
		return sharederror.New(sharederror.KindForbidden, "当前账号没有身份切换权限")
	}
	return nil
}
