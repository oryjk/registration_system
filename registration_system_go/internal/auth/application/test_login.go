package application

import (
	"context"
	"fmt"
	"strings"

	"github.com/oryjk/registration_system/registration_system_go/internal/auth/ports"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	userdomain "github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
	userports "github.com/oryjk/registration_system/registration_system_go/internal/user/ports"
)

type TestLoginService struct {
	users  userports.TestLoginRepository
	tokens ports.TokenService
}

type TestLoginTeam struct {
	ID   int64
	Name string
	Role string
}

type TestLoginUser struct {
	ID          int64
	DisplayName string
	AvatarURL   *string
	Teams       []TestLoginTeam
}

type TestLoginUsersResult struct {
	Items         []TestLoginUser
	DefaultUserID int64
}

type TestLoginResult struct {
	Token string
	User  userdomain.User
}

func NewTestLoginService(users userports.TestLoginRepository, tokens ports.TokenService) TestLoginService {
	return TestLoginService{users: users, tokens: tokens}
}

func (s TestLoginService) ListUsers(ctx context.Context, defaultUserID int64) (TestLoginUsersResult, error) {
	users, err := s.users.ListActiveTestLoginUsers(ctx)
	if err != nil {
		return TestLoginUsersResult{}, sharederror.Wrap(sharederror.KindInternal, "查询测试用户失败", err)
	}
	items := make([]TestLoginUser, 0, len(users))
	defaultFound := false
	for _, item := range users {
		if item.User.ID == defaultUserID {
			defaultFound = true
		}
		teams := make([]TestLoginTeam, 0, len(item.Teams))
		for _, team := range item.Teams {
			teams = append(teams, TestLoginTeam{ID: team.ID, Name: team.Name, Role: team.Role})
		}
		items = append(items, TestLoginUser{
			ID: item.User.ID, DisplayName: testDisplayName(item.User), AvatarURL: item.User.AvatarURL, Teams: teams,
		})
	}
	if !defaultFound {
		return TestLoginUsersResult{}, sharederror.New(sharederror.KindInternal, "默认 H5 测试用户不存在或已冻结")
	}
	return TestLoginUsersResult{Items: items, DefaultUserID: defaultUserID}, nil
}

func (s TestLoginService) Login(ctx context.Context, userID int64) (TestLoginResult, error) {
	user, found, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return TestLoginResult{}, sharederror.Wrap(sharederror.KindInternal, "查询测试用户失败", err)
	}
	if !found {
		return TestLoginResult{}, sharederror.New(sharederror.KindNotFound, "测试用户不存在")
	}
	if !user.IsActive() {
		return TestLoginResult{}, sharederror.New(sharederror.KindForbidden, "测试用户已冻结")
	}
	token, err := s.tokens.IssueUser(ctx, user.ID)
	if err != nil {
		return TestLoginResult{}, sharederror.Wrap(sharederror.KindInternal, "签发测试登录凭证失败", err)
	}
	return TestLoginResult{Token: token, User: user}, nil
}

func testDisplayName(user userdomain.User) string {
	if user.RealName != nil && strings.TrimSpace(*user.RealName) != "" {
		return strings.TrimSpace(*user.RealName)
	}
	if strings.TrimSpace(user.Nickname) != "" {
		return strings.TrimSpace(user.Nickname)
	}
	return fmt.Sprintf("用户 #%d", user.ID)
}
