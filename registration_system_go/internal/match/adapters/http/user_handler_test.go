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
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
)

func TestUserMatchRoutesReturnPrivacyScopedData(t *testing.T) {
	gin.SetMode(gin.TestMode)
	matchID := uuid.New()
	groupID := uuid.New()
	avatarURL := "https://cdn.example.com/player-37.png"
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
			Participants: []ports.UserParticipant{{
				UserID: 37, Nickname: "阿睿", AvatarURL: &avatarURL, Status: domain.RegistrationAttending,
			}},
		}}},
	}
	handler := NewUserHandler(service, nil)
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
	for _, expected := range []string{`"participants":[`, `"user_id":37`, `"nickname":"阿睿"`, `"avatar_url":"https://cdn.example.com/player-37.png"`, `"status":"attending"`} {
		if !bytes.Contains(body, []byte(expected)) {
			t.Fatalf("user detail response missing %s: %s", expected, detailResponse.Body.String())
		}
	}
	if !bytes.Contains(body, []byte(`"participants":[`)) {
		t.Fatalf("user detail response missing participants: %s", detailResponse.Body.String())
	}
	if bytes.Contains(body, []byte("created_by_admin_id")) || bytes.Contains(body, []byte("real_name")) {
		t.Fatalf("user response leaked admin or roster fields: %s", detailResponse.Body.String())
	}
	if service.actor.Kind != sharedauth.ActorUser || service.actor.ID != 42 || service.matchID != matchID {
		t.Fatalf("unexpected request mapping: actor=%+v match=%s", service.actor, service.matchID)
	}
}

func TestUserMatchListParsesScopeAndRejectsInvalidValue(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service := &fakeUserMatches{list: application.UserMatchListResult{Page: 2, PageSize: 10}}
	handler := NewUserHandler(service, nil)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	handler.RegisterRoutes(group)

	request := httptest.NewRequest(http.MethodGet, "/matches?scope=mine&status=ongoing&search=friend&page=2&page_size=10", nil)
	request.Header.Set("Authorization", "Bearer user-token")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK || service.query.Scope != application.MatchScopeMine || service.query.Status == nil || *service.query.Status != domain.MatchOngoing || service.query.Search != "friend" || service.query.Page != 2 || service.query.PageSize != 10 {
		t.Fatalf("scope query not parsed: status=%d query=%+v body=%s", response.Code, service.query, response.Body.String())
	}

	request = httptest.NewRequest(http.MethodGet, "/matches?scope=others&starts_after=2026-08-20T08:00:00Z", nil)
	request.Header.Set("Authorization", "Bearer user-token")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK || service.query.Scope != application.MatchScopeOthers ||
		service.query.StartsAfter == nil || !service.query.StartsAfter.Equal(time.Date(2026, 8, 20, 8, 0, 0, 0, time.UTC)) {
		t.Fatalf("others query not parsed: status=%d query=%+v body=%s", response.Code, service.query, response.Body.String())
	}

	request = httptest.NewRequest(http.MethodGet, "/matches?starts_after=not-a-time", nil)
	request.Header.Set("Authorization", "Bearer user-token")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("invalid starts_after status=%d body=%s", response.Code, response.Body.String())
	}

	request = httptest.NewRequest(http.MethodGet, "/matches?scope=team", nil)
	request.Header.Set("Authorization", "Bearer user-token")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("invalid scope status=%d body=%s", response.Code, response.Body.String())
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
					ID: matchID, Name: "周六晚场友谊赛", PublicationMode: domain.OnlineTeam, Status: domain.MatchRegistering,
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
			Match:        domain.Match{ID: uuid.New(), Name: "周一训练赛", PublicationMode: domain.OfflineConfirmed, Status: domain.MatchEnded, Location: "凤凰山体育公园"},
			HostTeamName: "城北联队",
		}},
		EndedHasMore: true,
	}}
	handler := NewUserHandler(service, nil)
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
		`"action_has_more":false`,
		`"name":"周六晚场友谊赛"`, `"opponent_name":"客家人"`,
		`"publication_mode":"online_team"`, `"publication_mode":"offline_confirmed"`,
		`"attending_count":6`, `"my_registration_status":"attending"`,
	} {
		if !bytes.Contains(body, []byte(expected)) {
			t.Fatalf("home response missing %s: %s", expected, response.Body.String())
		}
	}
	for _, forbidden := range []string{"created_by_admin_id", "real_name", "registrations", "upcoming_items"} {
		if bytes.Contains(body, []byte(forbidden)) {
			t.Fatalf("home response leaked %s: %s", forbidden, response.Body.String())
		}
	}
	if service.actor.Kind != sharedauth.ActorUser || service.actor.ID != 42 {
		t.Fatalf("unexpected home actor: %+v", service.actor)
	}
}

func TestUserMatchCreateUsesUserActorAndReturnsCreatedDetail(t *testing.T) {
	gin.SetMode(gin.TestMode)
	matchID := uuid.New()
	groupID := uuid.New()
	opponentName := "周末对手"
	service := &fakeUserMatches{detail: application.UserMatchDetail{
		Item: ports.MatchItem{
			Match: domain.Match{
				ID: matchID, Name: "周末友谊赛", PublicationMode: domain.OfflineConfirmed,
				HostTeamID: 7, StartTime: time.Date(2026, 8, 20, 10, 0, 0, 0, time.UTC),
				EndTime:      time.Date(2026, 8, 20, 12, 0, 0, 0, time.UTC),
				OpponentName: &opponentName,
			},
			HostTeamName: "东安联队",
		},
		Groups: []ports.UserGroupState{{Group: domain.RegistrationGroup{ID: groupID, MatchID: matchID, Kind: domain.GroupHostTeam}}},
	}}
	creator := &fakeUserCreateMatch{result: application.CreateMatchResult{Match: domain.Match{ID: matchID}}}
	handler := NewUserHandler(service, creator)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	handler.RegisterRoutes(group)

	request := httptest.NewRequest(http.MethodPost, "/matches", bytes.NewBufferString(`{
		"name":"周末友谊赛",
		"publication_mode":"offline_confirmed",
		"host_team_id":7,
		"opponent_name":"周末对手",
		"players_per_team":8,
		"start_time":"2026-08-20T10:00:00Z",
		"end_time":"2026-08-20T12:00:00Z",
		"location":"东安球场"
	}`))
	request.Header.Set("Authorization", "Bearer user-token")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"id":"`+matchID.String()+`"`)) {
		t.Fatalf("unexpected create response %d: %s", response.Code, response.Body.String())
	}
	if creator.actor.Kind != sharedauth.ActorUser || creator.actor.ID != 42 {
		t.Fatalf("unexpected create actor: %+v", creator.actor)
	}
	if creator.command.Name != "周末友谊赛" || creator.command.HostTeamID != 7 || creator.command.PublicationMode != domain.OfflineConfirmed || creator.command.PlayersPerTeam != 8 {
		t.Fatalf("unexpected create command: %+v", creator.command)
	}
	if service.matchID != matchID {
		t.Fatalf("expected created detail lookup for %s, got %s", matchID, service.matchID)
	}
}

type fakeUserMatches struct {
	list    application.UserMatchListResult
	detail  application.UserMatchDetail
	home    application.UserMatchHomeResult
	actor   sharedauth.Actor
	matchID uuid.UUID
	query   application.UserMatchListQuery
}

type fakeUserCreateMatch struct {
	result  application.CreateMatchResult
	actor   sharedauth.Actor
	command application.CreateMatchCommand
}

func (f *fakeUserCreateMatch) Execute(_ context.Context, actor sharedauth.Actor, command application.CreateMatchCommand) (application.CreateMatchResult, error) {
	f.actor = actor
	f.command = command
	return f.result, nil
}

func (f *fakeUserMatches) List(_ context.Context, actor sharedauth.Actor, query application.UserMatchListQuery) (application.UserMatchListResult, error) {
	f.actor = actor
	f.query = query
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
