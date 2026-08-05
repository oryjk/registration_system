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

func TestUserMatchHomeReturnsUserScopedSummary(t *testing.T) {
	gin.SetMode(gin.TestMode)
	matchID := uuid.New()
	groupID := uuid.New()
	maxPlayers := 8
	opponentName := "客家人"
	service := &fakeUserMatches{home: application.UserMatchHomeResult{
		ActionItems: []ports.HomeMatchItem{{
			Item: ports.MatchItem{
				Match: domain.Match{
					ID: matchID, Name: "周六晚场友谊赛", Status: domain.MatchRegistering,
					PlayersPerTeam: 8, Location: "驷马桥足球公园", OpponentName: &opponentName,
				},
				HostTeamName: "城北联队",
			},
			Group: ports.UserGroupState{
				Group: domain.RegistrationGroup{
					ID: groupID, MatchID: matchID, Kind: domain.GroupHostTeam,
					Status: domain.GroupOpen, MaxPlayers: &maxPlayers,
				},
				AttendingCount: 6,
				MyRegistration: &domain.Registration{
					ID: uuid.New(), GroupID: groupID, UserID: 42, Status: domain.RegistrationAttending, RegistrationCount: 1,
				},
			},
		}},
		EndedItems: []ports.MatchItem{{
			Match:        domain.Match{ID: uuid.New(), Name: "周一训练赛", Status: domain.MatchEnded, Location: "凤凰山体育公园"},
			HostTeamName: "城北联队",
		}},
		EndedHasMore: true,
	}}
	handler := NewUserHandler(service)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	handler.RegisterRoutes(group)

	request := httptest.NewRequest(http.MethodGet, "/matches/home", nil)
	request.Header.Set("Authorization", "Bearer user-token")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	body := response.Body.Bytes()
	if response.Code != http.StatusOK {
		t.Fatalf("unexpected home response %d: %s", response.Code, response.Body.String())
	}
	for _, expected := range []string{
		`"action_items"`, `"ended_items"`, `"ended_has_more":true`,
		`"name":"周六晚场友谊赛"`, `"opponent_name":"客家人"`,
		`"attending_count":6`, `"my_registration_status":"attending"`,
	} {
		if !bytes.Contains(body, []byte(expected)) {
			t.Fatalf("home response missing %s: %s", expected, response.Body.String())
		}
	}
	for _, forbidden := range []string{"created_by_admin_id", "real_name", "registrations"} {
		if bytes.Contains(body, []byte(forbidden)) {
			t.Fatalf("home response leaked %s: %s", forbidden, response.Body.String())
		}
	}
	if service.actor.Kind != sharedauth.ActorUser || service.actor.ID != 42 {
		t.Fatalf("unexpected home actor: %+v", service.actor)
	}
}

type fakeUserMatches struct {
	list    application.UserMatchListResult
	detail  application.UserMatchDetail
	home    application.UserMatchHomeResult
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

func (f *fakeUserMatches) Home(_ context.Context, actor sharedauth.Actor) (application.UserMatchHomeResult, error) {
	f.actor = actor
	return f.home, nil
}

type fakeUserTokens struct{}

func (fakeUserTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (fakeUserTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (fakeUserTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, nil
}

func int64Pointer(value int64) *int64 { return &value }
