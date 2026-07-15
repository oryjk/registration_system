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
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
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

func TestCreateAdminHandlerUsesAuthenticatedSuperAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service := &fakeAdminAuthService{created: domain.Admin{ID: 8, Username: "venue-east", Role: domain.AdminRoleAdmin, Status: domain.AdminStatusActive}}
	handler := NewAdminHandler(service)
	router := gin.New()
	router.POST("/admins", func(c *gin.Context) {
		c.Set(actorContextKey, sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 7, IsSuperAdmin: true})
		handler.CreateAdmin(c)
	})
	request := httptest.NewRequest(http.MethodPost, "/admins", bytes.NewBufferString(`{"username":"venue-east","password":"venue-pass-123"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"username":"venue-east"`)) {
		t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
	}
	if service.createActor.ID != 7 || !service.createActor.IsSuperAdmin {
		t.Fatalf("unexpected actor: %+v", service.createActor)
	}
}

func TestCreateAdminHandlerRejectsVenueAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewAdminHandler(&fakeAdminAuthService{err: sharederror.ErrForbidden})
	router := gin.New()
	router.POST("/admins", func(c *gin.Context) {
		c.Set(actorContextKey, sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 8})
		handler.CreateAdmin(c)
	})
	request := httptest.NewRequest(http.MethodPost, "/admins", bytes.NewBufferString(`{"username":"other","password":"venue-pass-123"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
	}
}

type fakeAdminAuthService struct {
	login       application.AdminLoginResult
	admin       domain.Admin
	created     domain.Admin
	admins      []domain.Admin
	createActor sharedauth.Actor
	err         error
}

func (f *fakeAdminAuthService) Login(context.Context, string, string) (application.AdminLoginResult, error) {
	return f.login, f.err
}

func (f *fakeAdminAuthService) Current(context.Context, sharedauth.Actor) (domain.Admin, error) {
	return f.admin, f.err
}

func (f *fakeAdminAuthService) CreateAdmin(_ context.Context, actor sharedauth.Actor, _, _ string) (domain.Admin, error) {
	f.createActor = actor
	return f.created, f.err
}

func (f *fakeAdminAuthService) ListAdmins(context.Context, sharedauth.Actor) ([]domain.Admin, error) {
	return f.admins, f.err
}
