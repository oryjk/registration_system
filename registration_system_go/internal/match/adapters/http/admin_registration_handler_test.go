package matchhttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
)

type fakeAdminRegistration struct {
	actor   sharedauth.Actor
	matchID uuid.UUID
	groupID uuid.UUID
	userID  int64
	status  domain.RegistrationStatus
}

func (f *fakeAdminRegistration) Put(_ context.Context, actor sharedauth.Actor, matchID, groupID uuid.UUID, userID int64, status domain.RegistrationStatus) (domain.Registration, error) {
	f.actor, f.matchID, f.groupID, f.userID, f.status = actor, matchID, groupID, userID, status
	return domain.Registration{GroupID: groupID, UserID: userID, Status: status, RegistrationCount: 1}, nil
}

func TestAdminRegistrationRouteValidatesAndUsesAdminActor(t *testing.T) {
	gin.SetMode(gin.TestMode)
	matchID, groupID := uuid.New(), uuid.New()
	path := "/api/v1/admin/matches/" + matchID.String() + "/groups/" + groupID.String() + "/registrations/42"
	for _, name := range []string{"valid", "unauthorized", "bad match", "bad group", "bad user", "missing status", "malformed body"} {
		t.Run(name, func(t *testing.T) {
			service := &fakeAdminRegistration{}
			router := gin.New()
			group := router.Group("/api/v1/admin", authhttp.NewMiddleware(fakeAdminTokens{}).RequireAdmin())
			NewAdminRegistrationHandler(service).RegisterRoutes(group)
			url, body, want := path, `{"status":"leave"}`, http.StatusOK
			switch name {
			case "unauthorized":
				want = http.StatusUnauthorized
			case "bad match":
				url = "/api/v1/admin/matches/invalid/groups/" + groupID.String() + "/registrations/42"
				want = http.StatusUnprocessableEntity
			case "bad group":
				url = "/api/v1/admin/matches/" + matchID.String() + "/groups/invalid/registrations/42"
				want = http.StatusUnprocessableEntity
			case "bad user":
				url = "/api/v1/admin/matches/" + matchID.String() + "/groups/" + groupID.String() + "/registrations/" + strconv.Itoa(0)
				want = http.StatusUnprocessableEntity
			case "missing status":
				body = `{}`
				want = http.StatusUnprocessableEntity
			case "malformed body":
				body = `{`
				want = http.StatusUnprocessableEntity
			}
			request := httptest.NewRequest(http.MethodPatch, url, bytes.NewBufferString(body))
			request.Header.Set("Content-Type", "application/json")
			if name != "unauthorized" {
				request.Header.Set("Authorization", "Bearer admin-token")
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != want {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
			if name == "valid" {
				if !service.actor.IsAdmin() || service.matchID != matchID || service.groupID != groupID || service.userID != 42 || service.status != domain.RegistrationLeave {
					t.Fatalf("incorrect command: %+v", service)
				}
				if !bytes.Contains(response.Body.Bytes(), []byte(`"code":0`)) || !bytes.Contains(response.Body.Bytes(), []byte(`"status":"leave"`)) {
					t.Fatalf("invalid response: %s", response.Body.String())
				}
			} else if service.userID != 0 {
				t.Fatal("invalid request reached application")
			}
		})
	}
}
