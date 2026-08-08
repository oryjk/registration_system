package application

import (
	"context"
	"errors"
	"testing"

	"github.com/oryjk/registration_system/registration_system_go/internal/auth/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	userdomain "github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
	userports "github.com/oryjk/registration_system/registration_system_go/internal/user/ports"
)

func TestTestLoginListsActiveUsersAndRequiresConfiguredDefault(t *testing.T) {
	realName := " 王睿 "
	repository := &fakeTestLoginUsers{items: []userports.TestLoginUser{
		{User: userdomain.User{ID: 37, Nickname: "nickname", RealName: &realName, Status: userdomain.StatusActive}, Teams: []userports.TestLoginTeam{{ID: 11, Name: "洺悦御府", Role: "captain"}}},
		{User: userdomain.User{ID: 40, Nickname: "", Status: userdomain.StatusActive}},
	}}
	service := NewTestLoginService(repository, &fakeTestLoginTokens{})

	result, err := service.ListUsers(context.Background(), 37)
	if err != nil {
		t.Fatalf("ListUsers() error=%v", err)
	}
	if result.DefaultUserID != 37 || len(result.Items) != 2 || result.Items[0].DisplayName != "王睿" || result.Items[1].DisplayName != "用户 #40" {
		t.Fatalf("unexpected result: %+v", result)
	}
	if result.Items[0].Teams[0].Role != "captain" {
		t.Fatalf("unexpected team projection: %+v", result.Items[0].Teams)
	}
}

func TestTestLoginRejectsMissingDefaultAndFrozenLogin(t *testing.T) {
	repository := &fakeTestLoginUsers{items: []userports.TestLoginUser{{User: userdomain.User{ID: 40, Status: userdomain.StatusActive}}}}
	service := NewTestLoginService(repository, &fakeTestLoginTokens{})
	if _, err := service.ListUsers(context.Background(), 37); !errors.Is(err, sharederror.ErrInternal) {
		t.Fatalf("ListUsers() error=%v, want internal", err)
	}

	repository.user = userdomain.User{ID: 37, Status: userdomain.StatusFrozen}
	repository.found = true
	if _, err := service.Login(context.Background(), 37); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("Login() error=%v, want forbidden", err)
	}
}

func TestTestLoginIssuesUserToken(t *testing.T) {
	repository := &fakeTestLoginUsers{user: userdomain.User{ID: 37, Nickname: "王睿", Status: userdomain.StatusActive}, found: true}
	tokens := &fakeTestLoginTokens{}
	service := NewTestLoginService(repository, tokens)

	result, err := service.Login(context.Background(), 37)
	if err != nil {
		t.Fatalf("Login() error=%v", err)
	}
	if result.Token != "user-token" || result.User.ID != 37 || tokens.userID != 37 {
		t.Fatalf("result=%+v token_user=%d", result, tokens.userID)
	}
}

type fakeTestLoginUsers struct {
	items []userports.TestLoginUser
	user  userdomain.User
	found bool
}

func (f *fakeTestLoginUsers) ListActiveTestLoginUsers(context.Context) ([]userports.TestLoginUser, error) {
	return f.items, nil
}

func (f *fakeTestLoginUsers) FindByID(context.Context, int64) (userdomain.User, bool, error) {
	return f.user, f.found, nil
}

type fakeTestLoginTokens struct{ userID int64 }

func (f *fakeTestLoginTokens) IssueUser(_ context.Context, userID int64) (string, error) {
	f.userID = userID
	return "user-token", nil
}

func (*fakeTestLoginTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (*fakeTestLoginTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return sharedauth.Actor{}, nil
}

var _ ports.TokenService = (*fakeTestLoginTokens)(nil)
