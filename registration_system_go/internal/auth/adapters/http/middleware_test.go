package authhttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	jwtadapter "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/jwt"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestRequireActiveUserRejectsFrozenAccountBeforeHandler(t *testing.T) {
	router, service := testRouter(t)
	checker := &fakeActiveUserChecker{err: sharederror.ErrUnauthorized}
	called := false
	router.GET("/user", NewMiddleware(service).RequireUser(), NewMiddleware(service).RequireActiveUser(checker), func(c *gin.Context) {
		called = true
		c.Status(http.StatusNoContent)
	})
	token, err := service.IssueUser(context.Background(), 42)
	if err != nil {
		t.Fatalf("issue user token: %v", err)
	}

	response := performRequest(router, "/user", token)
	if response.Code != http.StatusUnauthorized || called {
		t.Fatalf("status=%d handler_called=%v", response.Code, called)
	}
}

func TestRequireActiveUserReturnsInternalErrorForCheckerFailure(t *testing.T) {
	router, service := testRouter(t)
	checker := &fakeActiveUserChecker{err: errActiveUserLookup}
	router.GET("/user", NewMiddleware(service).RequireUser(), NewMiddleware(service).RequireActiveUser(checker), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	token, err := service.IssueUser(context.Background(), 42)
	if err != nil {
		t.Fatalf("issue user token: %v", err)
	}
	response := performRequest(router, "/user", token)
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("status=%d, want %d", response.Code, http.StatusInternalServerError)
	}
}

var errActiveUserLookup = errors.New("lookup failed")

type fakeActiveUserChecker struct{ err error }

func (f *fakeActiveUserChecker) EnsureActive(context.Context, int64) error { return f.err }

func TestRequireUserStoresUserActor(t *testing.T) {
	router, service := testRouter(t)
	router.GET("/user", NewMiddleware(service).RequireUser(), func(c *gin.Context) {
		actor, ok := ActorFromContext(c)
		if !ok {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.JSON(http.StatusOK, gin.H{"actor_id": actor.ID})
	})
	token, err := service.IssueUser(context.Background(), 42)
	if err != nil {
		t.Fatalf("issue user token: %v", err)
	}

	response := performRequest(router, "/user", token)
	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
}

func TestRequireUserRejectsAdminToken(t *testing.T) {
	router, service := testRouter(t)
	router.GET("/user", NewMiddleware(service).RequireUser(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	token, err := service.IssueAdmin(context.Background(), 7, true)
	if err != nil {
		t.Fatalf("issue admin token: %v", err)
	}

	response := performRequest(router, "/user", token)
	if response.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, response.Code)
	}
}

func TestRequireAdminRejectsUserToken(t *testing.T) {
	router, service := testRouter(t)
	router.GET("/admin", NewMiddleware(service).RequireAdmin(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	token, err := service.IssueUser(context.Background(), 42)
	if err != nil {
		t.Fatalf("issue user token: %v", err)
	}

	response := performRequest(router, "/admin", token)
	if response.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, response.Code)
	}
}

func TestRequireUserRejectsMissingToken(t *testing.T) {
	router, service := testRouter(t)
	router.GET("/user", NewMiddleware(service).RequireUser(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	response := performRequest(router, "/user", "")
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}
}

func testRouter(t *testing.T) (*gin.Engine, *jwtadapter.Service) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	service, err := jwtadapter.NewService("01234567890123456789012345678901", time.Hour)
	if err != nil {
		t.Fatalf("create JWT service: %v", err)
	}
	return gin.New(), service
}

func performRequest(router http.Handler, path, token string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodGet, path, nil)
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}
