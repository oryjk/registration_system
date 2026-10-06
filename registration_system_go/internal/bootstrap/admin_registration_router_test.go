package bootstrap

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	matchhttp "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/http"
	matchdomain "github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
)

func TestAdminRegistrationRouteRequiresAdminAndVersionedPath(t *testing.T) {
	matchID, groupID := uuid.New(), uuid.New()
	service := &routerAdminRegistration{}
	middleware := authhttp.NewMiddleware(routerAudienceTokens{})
	router := NewRouter(Dependencies{AuthMiddleware: &middleware, AdminRegistrations: matchhttp.NewAdminRegistrationHandler(service)})
	path := "/api/v1/admin/matches/" + matchID.String() + "/groups/" + groupID.String() + "/registrations/42"
	for _, test := range []struct {
		name, token, path string
		status            int
	}{
		{"unauthenticated", "", path, http.StatusUnauthorized},
		{"user token", "user-token", path, http.StatusForbidden},
		{"unversioned", "admin-token", strings.Replace(path, "/api/v1/", "/api/", 1), http.StatusNotFound},
		{"admin", "admin-token", path, http.StatusOK},
	} {
		t.Run(test.name, func(t *testing.T) {
			service.calls = 0
			request := httptest.NewRequest(http.MethodPatch, test.path, bytes.NewBufferString(`{"status":"leave"}`))
			if test.token != "" {
				request.Header.Set("Authorization", "Bearer "+test.token)
			}
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != test.status {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
			if test.status != http.StatusOK && service.calls != 0 {
				t.Fatal("unauthorized request reached use case")
			}
			if test.status == http.StatusOK && (service.calls != 1 || !service.actor.IsAdmin() || service.matchID != matchID || service.groupID != groupID || service.userID != 42 || service.status != matchdomain.RegistrationLeave) {
				t.Fatalf("incorrect command: %+v", service)
			}
		})
	}
}

type routerAdminRegistration struct {
	calls            int
	actor            sharedauth.Actor
	matchID, groupID uuid.UUID
	userID           int64
	status           matchdomain.RegistrationStatus
}

func (s *routerAdminRegistration) Put(_ context.Context, actor sharedauth.Actor, matchID, groupID uuid.UUID, userID int64, status matchdomain.RegistrationStatus) (matchdomain.Registration, error) {
	s.calls++
	s.actor, s.matchID, s.groupID, s.userID, s.status = actor, matchID, groupID, userID, status
	return matchdomain.Registration{GroupID: groupID, UserID: userID, Status: status, RegistrationCount: 1}, nil
}
