package authhttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/application"
	userdomain "github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

func TestTestAuthHandlerReturnsSafeUserListAndLogin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service := &fakeTestAuth{list: application.TestLoginUsersResult{
		DefaultUserID: 37,
		Items:         []application.TestLoginUser{{ID: 37, DisplayName: "王睿", Teams: []application.TestLoginTeam{{ID: 11, Name: "洺悦御府", Role: "captain"}}}},
	}, login: application.TestLoginResult{Token: "user-token", User: userdomain.User{ID: 37, Nickname: "王睿", Status: userdomain.StatusActive}}}
	handler := NewTestHandler(service, 37)
	router := gin.New()
	handler.RegisterRoutes(router.Group(""))

	listResponse := httptest.NewRecorder()
	router.ServeHTTP(listResponse, httptest.NewRequest(http.MethodGet, "/test-auth/users", nil))
	if listResponse.Code != http.StatusOK || !bytes.Contains(listResponse.Body.Bytes(), []byte(`"default_user_id":37`)) || bytes.Contains(listResponse.Body.Bytes(), []byte("openid")) {
		t.Fatalf("list response %d: %s", listResponse.Code, listResponse.Body.String())
	}

	request := httptest.NewRequest(http.MethodPost, "/test-auth/login", bytes.NewBufferString(`{"user_id":37}`))
	request.Header.Set("Content-Type", "application/json")
	loginResponse := httptest.NewRecorder()
	router.ServeHTTP(loginResponse, request)
	if loginResponse.Code != http.StatusOK || !bytes.Contains(loginResponse.Body.Bytes(), []byte(`"token":"user-token"`)) || service.userID != 37 {
		t.Fatalf("login response %d: %s user=%d", loginResponse.Code, loginResponse.Body.String(), service.userID)
	}
}

type fakeTestAuth struct {
	list   application.TestLoginUsersResult
	login  application.TestLoginResult
	userID int64
}

func (f *fakeTestAuth) ListUsers(context.Context, int64) (application.TestLoginUsersResult, error) {
	return f.list, nil
}
func (f *fakeTestAuth) Login(_ context.Context, userID int64) (application.TestLoginResult, error) {
	f.userID = userID
	return f.login, nil
}
