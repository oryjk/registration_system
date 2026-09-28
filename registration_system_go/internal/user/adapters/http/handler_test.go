package userhttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

func TestAdminUpdatesPlayerProfile(t *testing.T) {
	gin.SetMode(gin.TestMode)
	realName, phoneNumber := "王小明", "13800138000"
	service := &fakeProfileService{result: domain.User{
		ID: 7, Nickname: "小王", RealName: &realName, PhoneNumber: &phoneNumber, Status: domain.StatusActive,
	}}
	handler := NewHandler(service, nil)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeAdminTokens{}).RequireAdmin())
	handler.RegisterAdminRoutes(group)

	request := httptest.NewRequest(http.MethodPatch, "/users/7/profile", bytes.NewBufferString(`{"real_name":"王小明","phone_number":"13800138000"}`))
	request.Header.Set("Authorization", "Bearer admin-token")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"real_name":"王小明"`)) || !bytes.Contains(response.Body.Bytes(), []byte(`"phone_number":"13800138000"`)) {
		t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
	}
	if service.actor.ID != 1 || service.userID != 7 || service.realName != "王小明" || service.phoneNumber != "13800138000" {
		t.Fatalf("request was not mapped: %+v", service)
	}
}

func TestAdminListsUsersWithLastActiveAtAndActivityFilter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	lastActiveAt := time.Date(2026, 9, 28, 10, 30, 0, 0, time.UTC)
	users := &fakeAdminUsers{result: application.AdminUserListResult{
		Items: []domain.User{{ID: 7, Nickname: "小王", Status: domain.StatusActive, LastActiveAt: &lastActiveAt}},
		Total: 1, Page: 1, PageSize: 20,
	}}
	handler := NewHandler(nil, users)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeAdminTokens{}).RequireAdmin())
	handler.RegisterAdminRoutes(group)

	request := httptest.NewRequest(http.MethodGet, "/users?activity=active_7d", nil)
	request.Header.Set("Authorization", "Bearer admin-token")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"last_active_at":"2026-09-28T10:30:00Z"`)) {
		t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
	}
	if users.query.Activity != "active_7d" {
		t.Fatalf("activity query=%q, want active_7d", users.query.Activity)
	}
}

type fakeAdminUsers struct {
	result application.AdminUserListResult
	query  application.AdminUserListQuery
}

func (f *fakeAdminUsers) List(_ context.Context, _ sharedauth.Actor, query application.AdminUserListQuery) (application.AdminUserListResult, error) {
	f.query = query
	return f.result, nil
}

func (f *fakeAdminUsers) SetMatchAdmin(context.Context, sharedauth.Actor, int64, bool) (domain.User, error) {
	return domain.User{}, nil
}

type fakeProfileService struct {
	result      domain.User
	actor       sharedauth.Actor
	userID      int64
	realName    string
	phoneNumber string
}

func (f *fakeProfileService) Update(_ context.Context, actor sharedauth.Actor, userID int64, realName, phoneNumber string) (domain.User, error) {
	f.actor, f.userID, f.realName, f.phoneNumber = actor, userID, realName, phoneNumber
	return f.result, nil
}

type fakeAdminTokens struct{}

func (fakeAdminTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (fakeAdminTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (fakeAdminTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, nil
}
