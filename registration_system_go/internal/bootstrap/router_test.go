package bootstrap

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	authapplication "github.com/oryjk/registration_system/registration_system_go/internal/auth/application"
	authdomain "github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	userdomain "github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

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
