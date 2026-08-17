package minireviewhttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/minireview/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/minireview/domain"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
)

func TestReviewStatusEndpointReturnsRegisteredStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(&fakeService{
		status: domain.MiniReviewStatus{ProjectCode: "registration_system_mini", Version: "1.0.39", VersionCode: 10039, IsReviewing: true, StatusText: "正在审核"},
	}, "")
	router := gin.New()
	handler.RegisterPublicRoutes(router.Group(""))

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/mini-review/review-status?project_code=registration_system_mini&version=1.0.39", nil))

	if response.Code != http.StatusOK {
		t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
	}
	for _, expected := range []string{`"is_reviewing":true`, `"status_text":"正在审核"`, `"version":"1.0.39"`} {
		if !bytes.Contains(response.Body.Bytes(), []byte(expected)) {
			t.Fatalf("expected %s in response: %s", expected, response.Body.String())
		}
	}
}

func TestAllocateRequiresMatchingApiKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name       string
		configured string
		presented  string
		wantStatus int
	}{
		{name: "matching key passes", configured: "secret", presented: "secret", wantStatus: http.StatusOK},
		{name: "wrong key is rejected", configured: "secret", presented: "other", wantStatus: http.StatusForbidden},
		{name: "missing key is rejected", configured: "secret", presented: "", wantStatus: http.StatusForbidden},
		{name: "unconfigured endpoint is closed", configured: "", presented: "secret", wantStatus: http.StatusForbidden},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := NewHandler(&fakeService{}, tt.configured)
			router := gin.New()
			handler.RegisterAllocateRoutes(router.Group(""))
			request := httptest.NewRequest(http.MethodPost, "/mini-review/allocate", bytes.NewBufferString(`{"project_code":"registration_system_mini","current_version":"1.0.38"}`))
			request.Header.Set("Content-Type", "application/json")
			if tt.presented != "" {
				request.Header.Set("X-Api-Key", tt.presented)
			}
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != tt.wantStatus {
				t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
			}
		})
	}
}

func TestAllocatePassesCommandThrough(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service := &fakeService{
		status: domain.MiniReviewStatus{ProjectCode: "registration_system_mini", Version: "1.0.39", VersionCode: 10039, IsReviewing: true},
	}
	handler := NewHandler(service, "secret")
	router := gin.New()
	handler.RegisterAllocateRoutes(router.Group(""))
	request := httptest.NewRequest(http.MethodPost, "/mini-review/allocate", bytes.NewBufferString(`{"project_code":"registration_system_mini","current_version":"1.0.38","version":"1.0.39"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Api-Key", "secret")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
	}
	if service.allocateCommand != (application.AllocateCommand{
		ProjectCode: "registration_system_mini", CurrentVersion: "1.0.38", ExplicitVersion: "1.0.39",
	}) {
		t.Fatalf("unexpected command: %+v", service.allocateCommand)
	}
}

func newAdminRouter(service Service) *gin.Engine {
	router := gin.New()
	admin := router.Group("/api/v1/admin", authhttp.NewMiddleware(fakeTokens{}).RequireAdmin())
	serviceHandler := NewHandler(service, "")
	serviceHandler.RegisterAdminRoutes(admin)
	return router
}

func TestAdminSetStatusRequiresAdminActor(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := newAdminRouter(&fakeService{})
	request := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/mini-review/statuses/7", bytes.NewBufferString(`{"is_reviewing":false,"status_text":"审核通过"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthorized without token, got %d: %s", response.Code, response.Body.String())
	}
}

func TestAdminSetStatusUpdatesRecord(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service := &fakeService{
		status: domain.MiniReviewStatus{ID: 7, ProjectCode: "registration_system_mini", Version: "1.0.39", IsReviewing: false, StatusText: "审核通过"},
	}
	router := newAdminRouter(service)
	request := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/mini-review/statuses/7", bytes.NewBufferString(`{"is_reviewing":false,"status_text":"审核通过"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer admin-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
	}
	if service.setStatusCommand != (application.SetStatusCommand{ID: 7, IsReviewing: false, StatusText: "审核通过"}) {
		t.Fatalf("unexpected command: %+v", service.setStatusCommand)
	}
}

type fakeTokens struct{}

func (fakeTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (fakeTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (fakeTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 7, IsSuperAdmin: true}, nil
}

type fakeService struct {
	status           domain.MiniReviewStatus
	allocateCommand  application.AllocateCommand
	setStatusCommand application.SetStatusCommand
}

func (f *fakeService) Allocate(_ context.Context, command application.AllocateCommand) (domain.MiniReviewStatus, error) {
	f.allocateCommand = command
	return f.status, nil
}

func (f *fakeService) GetReviewStatus(context.Context, string, string) (domain.MiniReviewStatus, error) {
	return f.status, nil
}

func (f *fakeService) List(context.Context, sharedauth.Actor, application.StatusListQuery) (application.StatusListResult, error) {
	return application.StatusListResult{}, nil
}

func (f *fakeService) SetStatus(_ context.Context, _ sharedauth.Actor, command application.SetStatusCommand) (domain.MiniReviewStatus, error) {
	f.setStatusCommand = command
	return f.status, nil
}
