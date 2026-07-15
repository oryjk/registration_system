package authhttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
)

func TestAdminLoginHandlerReturnsAccessToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewAdminHandler(&fakeAdminAuthService{login: application.AdminLoginResult{
		Token: "admin-token", Admin: domain.Admin{ID: 7, Username: "admin", Role: domain.AdminRoleSuper, Status: domain.AdminStatusActive},
	}})
	router := gin.New()
	router.POST("/login", handler.Login)
	request := httptest.NewRequest(http.MethodPost, "/login", bytes.NewBufferString(`{"username":"admin","password":"secret1234"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"access_token":"admin-token"`)) {
		t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
	}
}

type fakeAdminAuthService struct {
	login application.AdminLoginResult
	admin domain.Admin
	err   error
}

func (f *fakeAdminAuthService) Login(context.Context, string, string) (application.AdminLoginResult, error) {
	return f.login, f.err
}

func (f *fakeAdminAuthService) Current(context.Context, sharedauth.Actor) (domain.Admin, error) {
	return f.admin, f.err
}
