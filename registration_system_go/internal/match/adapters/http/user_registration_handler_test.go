package matchhttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestUserRegistrationRoutesMapPutAndDelete(t *testing.T) {
	gin.SetMode(gin.TestMode)
	matchID, groupID := uuid.New(), uuid.New()
	updatedAt := time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC)
	service := &fakeUserRegistrationService{registration: domain.Registration{
		ID: uuid.New(), GroupID: groupID, UserID: 42, Status: domain.RegistrationAttending,
		RegistrationCount: 1, CreatedAt: updatedAt.Add(-time.Hour), UpdatedAt: updatedAt,
	}}
	router := userRegistrationTestRouter(service)

	put := httptest.NewRequest(http.MethodPut, "/matches/"+matchID.String()+"/groups/"+groupID.String()+"/my-registration", bytes.NewBufferString(`{"status":"attending","registration_count":1}`))
	put.Header.Set("Authorization", "Bearer user-token")
	put.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, put)
	if response.Code != http.StatusOK {
		t.Fatalf("put status=%d body=%s", response.Code, response.Body.String())
	}
	for _, expected := range []string{`"group_id":"` + groupID.String() + `"`, `"user_id":42`, `"status":"attending"`, `"registration_count":1`, `"updated_at":"2026-08-08T12:00:00Z"`} {
		if !bytes.Contains(response.Body.Bytes(), []byte(expected)) {
			t.Fatalf("put response missing %s: %s", expected, response.Body.String())
		}
	}
	for _, forbidden := range []string{`"id":`, `"created_at":`, `"cancelled_at":`} {
		if bytes.Contains(response.Body.Bytes(), []byte(forbidden)) {
			t.Fatalf("put response leaked %s: %s", forbidden, response.Body.String())
		}
	}
	if service.action != "put" || service.actor.ID != 42 || service.matchID != matchID || service.groupID != groupID || service.command.Status != domain.RegistrationAttending || service.command.RegistrationCount != 1 {
		t.Fatalf("put mapping failed: %+v", service)
	}

	service.registration.Status = domain.RegistrationCancelled
	deleteRequest := httptest.NewRequest(http.MethodDelete, "/matches/"+matchID.String()+"/groups/"+groupID.String()+"/my-registration", nil)
	deleteRequest.Header.Set("Authorization", "Bearer user-token")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, deleteRequest)
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"status":"cancelled"`)) || service.action != "delete" {
		t.Fatalf("delete status=%d action=%s body=%s", response.Code, service.action, response.Body.String())
	}
}

func TestUserRegistrationRoutesRejectInvalidProtocolInput(t *testing.T) {
	gin.SetMode(gin.TestMode)
	matchID, groupID := uuid.New(), uuid.New()
	tests := []struct {
		name   string
		method string
		path   string
		body   string
		token  bool
		status int
	}{
		{name: "missing token", method: http.MethodDelete, path: "/matches/" + matchID.String() + "/groups/" + groupID.String() + "/my-registration", status: http.StatusUnauthorized},
		{name: "invalid match id", method: http.MethodDelete, path: "/matches/not-a-uuid/groups/" + groupID.String() + "/my-registration", token: true, status: http.StatusUnprocessableEntity},
		{name: "invalid group id", method: http.MethodDelete, path: "/matches/" + matchID.String() + "/groups/not-a-uuid/my-registration", token: true, status: http.StatusUnprocessableEntity},
		{name: "invalid json", method: http.MethodPut, path: "/matches/" + matchID.String() + "/groups/" + groupID.String() + "/my-registration", body: `{`, token: true, status: http.StatusUnprocessableEntity},
		{name: "missing count", method: http.MethodPut, path: "/matches/" + matchID.String() + "/groups/" + groupID.String() + "/my-registration", body: `{"status":"attending"}`, token: true, status: http.StatusUnprocessableEntity},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			service := &fakeUserRegistrationService{}
			router := userRegistrationTestRouter(service)
			request := httptest.NewRequest(test.method, test.path, bytes.NewBufferString(test.body))
			if test.token {
				request.Header.Set("Authorization", "Bearer user-token")
			}
			if test.body != "" {
				request.Header.Set("Content-Type", "application/json")
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != test.status || service.calls != 0 {
				t.Fatalf("status=%d calls=%d body=%s", response.Code, service.calls, response.Body.String())
			}
		})
	}
}

func TestUserRegistrationRoutesMapApplicationErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	matchID, groupID := uuid.New(), uuid.New()
	tests := []struct {
		name   string
		err    error
		status int
	}{
		{name: "forbidden", err: sharederror.ErrForbidden, status: http.StatusForbidden},
		{name: "not found", err: sharederror.ErrNotFound, status: http.StatusNotFound},
		{name: "conflict", err: sharederror.ErrConflict, status: http.StatusConflict},
		{name: "validation", err: sharederror.ErrValidation, status: http.StatusUnprocessableEntity},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			service := &fakeUserRegistrationService{err: test.err}
			router := userRegistrationTestRouter(service)
			request := httptest.NewRequest(http.MethodPut, "/matches/"+matchID.String()+"/groups/"+groupID.String()+"/my-registration", bytes.NewBufferString(`{"status":"attending","registration_count":1}`))
			request.Header.Set("Authorization", "Bearer user-token")
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != test.status {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
		})
	}
}

func userRegistrationTestRouter(service UserRegistrationUseCase) *gin.Engine {
	router := gin.New()
	routes := router.Group("")
	routes.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	NewUserRegistrationHandler(service).RegisterRoutes(routes)
	return router
}

type fakeUserRegistrationService struct {
	registration domain.Registration
	err          error
	calls        int
	action       string
	actor        sharedauth.Actor
	matchID      uuid.UUID
	groupID      uuid.UUID
	command      application.PutMyRegistrationCommand
}

func (f *fakeUserRegistrationService) Put(_ context.Context, actor sharedauth.Actor, matchID, groupID uuid.UUID, command application.PutMyRegistrationCommand) (domain.Registration, error) {
	f.calls++
	f.action, f.actor, f.matchID, f.groupID, f.command = "put", actor, matchID, groupID, command
	return f.registration, f.err
}

func (f *fakeUserRegistrationService) Delete(_ context.Context, actor sharedauth.Actor, matchID, groupID uuid.UUID) (domain.Registration, error) {
	f.calls++
	f.action, f.actor, f.matchID, f.groupID = "delete", actor, matchID, groupID
	return f.registration, f.err
}

var _ UserRegistrationUseCase = (*fakeUserRegistrationService)(nil)
