package bootstrap

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	authapplication "github.com/oryjk/registration_system/registration_system_go/internal/auth/application"
	authdomain "github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
	matchhttp "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/http"
	matchapplication "github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	matchdomain "github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	userdomain "github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

func TestAppUserRegistrationRoutesAreProtectedAndVersioned(t *testing.T) {
	matchID, groupID := uuid.New(), uuid.New()
	registrationService := &routerUserRegistration{registration: matchdomain.Registration{
		GroupID: groupID, UserID: 42, Status: matchdomain.RegistrationAttending,
		RegistrationCount: 1, UpdatedAt: time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC),
	}}
	middleware := authhttp.NewMiddleware(routerUserTokens{})
	router := NewRouter(Dependencies{
		AuthMiddleware:    &middleware,
		UserRegistrations: matchhttp.NewUserRegistrationHandler(registrationService),
	})
	path := "/api/v1/app/matches/" + matchID.String() + "/groups/" + groupID.String() + "/my-registration"

	unauthorized := httptest.NewRecorder()
	router.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodDelete, path, nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized status=%d body=%s", unauthorized.Code, unauthorized.Body.String())
	}

	request := httptest.NewRequest(http.MethodPut, path, bytes.NewBufferString(`{"status":"attending","registration_count":1}`))
	request.Header.Set("Authorization", "Bearer user-token")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK || registrationService.actor.ID != 42 {
		t.Fatalf("authorized status=%d actor=%+v body=%s", response.Code, registrationService.actor, response.Body.String())
	}

	unversioned := httptest.NewRecorder()
	router.ServeHTTP(unversioned, httptest.NewRequest(http.MethodPut, "/api/app/matches/"+matchID.String()+"/groups/"+groupID.String()+"/my-registration", nil))
	if unversioned.Code != http.StatusNotFound {
		t.Fatalf("unversioned route status=%d", unversioned.Code)
	}
}

func TestHealthRoute(t *testing.T) {
	router := NewRouter(Dependencies{})
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	const expected = `{"code":0,"message":"ok","data":{"status":"ok"}}`
	if response.Body.String() != expected {
		t.Fatalf("expected body %s, got %s", expected, response.Body.String())
	}
}

func TestBusinessRoutesUseVersionedAudiencePrefixesOnly(t *testing.T) {
	router := NewRouter(Dependencies{
		UserAuth:  authhttp.NewHandler(routerWechatLogin{}),
		AdminAuth: authhttp.NewAdminHandler(routerAdminAuth{}),
	})

	tests := []struct {
		method string
		path   string
		want   int
	}{
		{http.MethodPost, "/api/v1/app/auth/wechat/login", http.StatusUnprocessableEntity},
		{http.MethodPost, "/api/v1/admin/auth/login", http.StatusUnprocessableEntity},
		{http.MethodPost, "/api/auth/wechat/login", http.StatusNotFound},
		{http.MethodPost, "/api/admin/auth/login", http.StatusNotFound},
	}
	for _, test := range tests {
		t.Run(test.path, func(t *testing.T) {
			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(test.method, test.path, nil))
			if response.Code != test.want {
				t.Fatalf("%s %s returned %d, want %d", test.method, test.path, response.Code, test.want)
			}
		})
	}
}

func TestH5TestAuthRoutesAreRegisteredOnlyWhenEnabled(t *testing.T) {
	testAuth := authhttp.NewTestHandler(routerTestAuth{}, 37)
	for name, test := range map[string]struct {
		enabled bool
		want    int
	}{
		"disabled": {want: http.StatusNotFound},
		"enabled":  {enabled: true, want: http.StatusOK},
	} {
		t.Run(name, func(t *testing.T) {
			router := NewRouter(Dependencies{TestAuth: testAuth, H5TestLoginEnabled: test.enabled})
			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/app/test-auth/users", nil))
			if response.Code != test.want {
				t.Fatalf("status=%d, want %d", response.Code, test.want)
			}
		})
	}
}

type routerWechatLogin struct{}

func (routerWechatLogin) Execute(context.Context, string) (authapplication.WechatLoginResult, error) {
	return authapplication.WechatLoginResult{User: userdomain.User{Status: userdomain.StatusActive}}, nil
}

type routerAdminAuth struct{}

type routerTestAuth struct{}

func (routerTestAuth) ListUsers(context.Context, int64) (authapplication.TestLoginUsersResult, error) {
	return authapplication.TestLoginUsersResult{DefaultUserID: 37}, nil
}

func (routerTestAuth) Login(context.Context, int64) (authapplication.TestLoginResult, error) {
	return authapplication.TestLoginResult{}, nil
}

func (routerAdminAuth) Login(context.Context, string, string) (authapplication.AdminLoginResult, error) {
	return authapplication.AdminLoginResult{}, nil
}

func (routerAdminAuth) Current(context.Context, sharedauth.Actor) (authdomain.Admin, error) {
	return authdomain.Admin{}, nil
}

func (routerAdminAuth) CreateAdmin(context.Context, sharedauth.Actor, string, string) (authdomain.Admin, error) {
	return authdomain.Admin{}, nil
}

func (routerAdminAuth) ListAdmins(context.Context, sharedauth.Actor) ([]authdomain.Admin, error) {
	return nil, nil
}

type routerUserTokens struct{}

func (routerUserTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (routerUserTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (routerUserTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, nil
}

type routerUserRegistration struct {
	registration matchdomain.Registration
	actor        sharedauth.Actor
}

func (r *routerUserRegistration) Put(_ context.Context, actor sharedauth.Actor, _, _ uuid.UUID, _ matchapplication.PutMyRegistrationCommand) (matchdomain.Registration, error) {
	r.actor = actor
	return r.registration, nil
}

func (r *routerUserRegistration) Delete(_ context.Context, actor sharedauth.Actor, _, _ uuid.UUID) (matchdomain.Registration, error) {
	r.actor = actor
	return r.registration, nil
}
