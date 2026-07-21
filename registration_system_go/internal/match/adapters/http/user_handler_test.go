package matchhttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
)

func TestUserMatchRoutesReturnPrivacyScopedData(t *testing.T) {
	gin.SetMode(gin.TestMode)
	matchID := uuid.New()
	groupID := uuid.New()
	registration := &domain.Registration{
		ID: uuid.New(), GroupID: groupID, UserID: 42,
		Status: domain.RegistrationAttending, RegistrationCount: 1,
	}
	item := ports.MatchItem{
		Match: domain.Match{
			ID: matchID, Name: "散人约球", PublicationMode: domain.OnlineIndividual,
			OpponentState: domain.OpponentRecruiting, Status: domain.MatchRegistering,
			HostTeamID: 7, CreatedByAdminID: int64Pointer(9),
		},
		HostTeamName: "东安联队",
	}
	service := &fakeUserMatches{
		list: application.UserMatchListResult{Items: []ports.MatchItem{item}, Total: 1, Page: 1, PageSize: 20},
		detail: application.UserMatchDetail{Item: item, Groups: []ports.UserGroupState{{
			Group: domain.RegistrationGroup{
				ID: groupID, MatchID: matchID, Kind: domain.GroupIndividualOpponent,
				Status: domain.GroupOpen,
			},
			AttendingCount: 7, MyRegistration: registration,
		}}},
	}
	handler := NewUserHandler(service)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	handler.RegisterRoutes(group)

	listRequest := httptest.NewRequest(http.MethodGet, "/matches?page=1&page_size=20", nil)
	listRequest.Header.Set("Authorization", "Bearer user-token")
	listResponse := httptest.NewRecorder()
	router.ServeHTTP(listResponse, listRequest)
	if listResponse.Code != http.StatusOK || !bytes.Contains(listResponse.Body.Bytes(), []byte(`"publication_mode":"online_individual"`)) {
		t.Fatalf("unexpected list response %d: %s", listResponse.Code, listResponse.Body.String())
	}

	detailRequest := httptest.NewRequest(http.MethodGet, "/matches/"+matchID.String(), nil)
	detailRequest.Header.Set("Authorization", "Bearer user-token")
	detailResponse := httptest.NewRecorder()
	router.ServeHTTP(detailResponse, detailRequest)
	body := detailResponse.Body.Bytes()
	if detailResponse.Code != http.StatusOK || !bytes.Contains(body, []byte(`"attending_count":7`)) || !bytes.Contains(body, []byte(`"my_registration":{"status":"attending","registration_count":1}`)) {
		t.Fatalf("unexpected detail response %d: %s", detailResponse.Code, detailResponse.Body.String())
	}
	if bytes.Contains(body, []byte("created_by_admin_id")) || bytes.Contains(body, []byte("real_name")) {
		t.Fatalf("user response leaked admin or roster fields: %s", detailResponse.Body.String())
	}
	if service.actor.Kind != sharedauth.ActorUser || service.actor.ID != 42 || service.matchID != matchID {
		t.Fatalf("unexpected request mapping: actor=%+v match=%s", service.actor, service.matchID)
	}
}

type fakeUserMatches struct {
	list    application.UserMatchListResult
	detail  application.UserMatchDetail
	actor   sharedauth.Actor
	matchID uuid.UUID
}

func (f *fakeUserMatches) List(_ context.Context, actor sharedauth.Actor, _ application.UserMatchListQuery) (application.UserMatchListResult, error) {
	f.actor = actor
	return f.list, nil
}

func (f *fakeUserMatches) Get(_ context.Context, actor sharedauth.Actor, id uuid.UUID) (application.UserMatchDetail, error) {
	f.actor = actor
	f.matchID = id
	return f.detail, nil
}

type fakeUserTokens struct{}

func (fakeUserTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (fakeUserTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (fakeUserTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, nil
}

func int64Pointer(value int64) *int64 { return &value }
