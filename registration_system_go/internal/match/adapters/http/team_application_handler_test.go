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
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
)

func TestTeamApplicationUserRoutesMapAuthenticatedActorAndIDs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	matchID := uuid.New()
	applicationID := uuid.New()
	service := &fakeTeamApplicationService{application: domain.TeamApplication{
		ID: applicationID, MatchID: matchID, ApplicantTeamID: 8, Introduction: "阵容齐整",
		Status: domain.ApplicationPending, CreatedByUserID: 42, CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}}
	handler := NewTeamApplicationHandler(service)
	router := gin.New()
	routes := router.Group("")
	routes.Use(authhttp.NewMiddleware(teamApplicationTokens{actor: sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}}).RequireUser())
	handler.RegisterUserRoutes(routes)

	request := httptest.NewRequest(http.MethodPost, "/matches/"+matchID.String()+"/team-applications", bytes.NewBufferString(`{"team_id":8,"introduction":"阵容齐整"}`))
	request.Header.Set("Authorization", "Bearer user-token")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"status":"pending"`)) {
		t.Fatalf("unexpected apply response %d: %s", response.Code, response.Body.String())
	}
	if service.actor.ID != 42 || service.matchID != matchID || service.teamID != 8 {
		t.Fatalf("unexpected apply mapping: %+v", service)
	}

	request = httptest.NewRequest(http.MethodPost, "/matches/"+matchID.String()+"/team-applications/"+applicationID.String()+"/select", nil)
	request.Header.Set("Authorization", "Bearer user-token")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK || service.applicationID != applicationID || service.operation != "select" {
		t.Fatalf("unexpected select response %d: %s service=%+v", response.Code, response.Body.String(), service)
	}
}

type fakeTeamApplicationService struct {
	application   domain.TeamApplication
	actor         sharedauth.Actor
	matchID       uuid.UUID
	applicationID uuid.UUID
	teamID        int64
	operation     string
}

func (f *fakeTeamApplicationService) List(_ context.Context, actor sharedauth.Actor, matchID uuid.UUID) ([]ports.TeamApplicationItem, error) {
	f.actor, f.matchID = actor, matchID
	return []ports.TeamApplicationItem{{Application: f.application, TeamName: "候选队"}}, nil
}

func (f *fakeTeamApplicationService) Apply(_ context.Context, actor sharedauth.Actor, matchID uuid.UUID, teamID int64, _ string) (domain.TeamApplication, error) {
	f.actor, f.matchID, f.teamID, f.operation = actor, matchID, teamID, "apply"
	return f.application, nil
}

func (f *fakeTeamApplicationService) Select(_ context.Context, actor sharedauth.Actor, matchID, applicationID uuid.UUID) (domain.TeamApplication, error) {
	f.actor, f.matchID, f.applicationID, f.operation = actor, matchID, applicationID, "select"
	return f.application, nil
}

func (f *fakeTeamApplicationService) Withdraw(_ context.Context, actor sharedauth.Actor, matchID, applicationID uuid.UUID) (domain.TeamApplication, error) {
	f.actor, f.matchID, f.applicationID, f.operation = actor, matchID, applicationID, "withdraw"
	return f.application, nil
}

type teamApplicationTokens struct {
	actor sharedauth.Actor
}

func (teamApplicationTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (teamApplicationTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (t teamApplicationTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return t.actor, nil
}
