package teamhttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	jwtadapter "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/jwt"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

func TestMyTeamsHandlerUsesAuthenticatedUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tokens, err := jwtadapter.NewService("01234567890123456789012345678901", time.Hour)
	if err != nil {
		t.Fatalf("create JWT service: %v", err)
	}
	token, err := tokens.IssueUser(context.Background(), 42)
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}
	query := &fakeTeamQuery{items: []domain.TeamMembership{{
		Team:   domain.Team{ID: 7, Name: "东安联队", Status: domain.TeamActive},
		Member: domain.Member{TeamID: 7, UserID: 42, Role: domain.RoleLeader, Status: domain.MemberActive},
	}}}
	handler := NewHandler(query, &fakeTeamMembers{})
	router := gin.New()
	router.GET("/teams", authhttp.NewMiddleware(tokens).RequireUser(), handler.MyTeams)
	request := httptest.NewRequest(http.MethodGet, "/teams?user_id=999", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, response.Code, response.Body.String())
	}
	if query.receivedUserID != 42 {
		t.Fatalf("expected authenticated user 42, got %d", query.receivedUserID)
	}
	if !bytes.Contains(response.Body.Bytes(), []byte(`"role":"leader"`)) {
		t.Fatalf("expected leader role in response: %s", response.Body.String())
	}
}

func TestAdminTeamCRUDRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := time.Date(2026, time.July, 15, 8, 30, 0, 0, time.UTC)
	captainID := int64(42)
	team := domain.Team{
		ID: 7, Name: "东安联队", Status: domain.TeamActive, CreatedAt: now, UpdatedAt: now,
		CaptainID: &captainID,
		Captain:   &domain.CaptainSummary{UserID: captainID, Nickname: "队长昵称"},
	}
	query := &fakeTeamQuery{teams: []domain.Team{team}, team: team}
	handler := NewHandler(query, &fakeTeamMembers{})
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeAdminTokens{}).RequireAdmin())
	handler.RegisterAdminRoutes(group)

	tests := []struct {
		name       string
		method     string
		path       string
		body       string
		wantBody   string
		wantTeamID int64
	}{
		{name: "list", method: http.MethodGet, path: "/teams", wantBody: `"captain":{"user_id":42,"nickname":"队长昵称"`},
		{name: "get", method: http.MethodGet, path: "/teams/7", wantBody: `"name":"东安联队"`, wantTeamID: 7},
		{name: "create", method: http.MethodPost, path: "/teams", body: `{"name":"东安联队"}`, wantBody: `"status":"active"`},
		{name: "update", method: http.MethodPatch, path: "/teams/7", body: `{"name":"东安新队","description":null,"status":"frozen"}`, wantBody: `"name":"东安新队"`, wantTeamID: 7},
		{name: "delete", method: http.MethodDelete, path: "/teams/7", wantBody: `"id":7`, wantTeamID: 7},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(test.method, test.path, bytes.NewBufferString(test.body))
			request.Header.Set("Authorization", "Bearer admin-token")
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(test.wantBody)) {
				t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
			}
			if test.wantTeamID != 0 && query.receivedTeamID != test.wantTeamID {
				t.Fatalf("expected team ID %d, got %d", test.wantTeamID, query.receivedTeamID)
			}
			if query.receivedActor.ID != 7 {
				t.Fatalf("expected admin actor 7, got %+v", query.receivedActor)
			}
		})
	}
}

type fakeAdminTokens struct{}

func (fakeAdminTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (fakeAdminTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (fakeAdminTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 7}, nil
}

type fakeTeamQuery struct {
	items          []domain.TeamMembership
	teams          []domain.Team
	team           domain.Team
	receivedUserID int64
	receivedTeamID int64
	receivedActor  sharedauth.Actor
	err            error
}

func (f *fakeTeamQuery) ListByUser(_ context.Context, userID int64) ([]domain.TeamMembership, error) {
	f.receivedUserID = userID
	return f.items, f.err
}

func (f *fakeTeamQuery) ListTeams(_ context.Context, actor sharedauth.Actor, _ *domain.TeamStatus) ([]domain.Team, error) {
	f.receivedActor = actor
	return f.teams, f.err
}

func (f *fakeTeamQuery) GetTeam(_ context.Context, actor sharedauth.Actor, teamID int64) (domain.Team, error) {
	f.receivedActor = actor
	f.receivedTeamID = teamID
	return f.team, f.err
}

func (f *fakeTeamQuery) CreateTeam(_ context.Context, actor sharedauth.Actor, name string, description *string) (domain.Team, error) {
	f.receivedActor = actor
	f.team.Name = name
	f.team.Description = description
	return f.team, f.err
}

func (f *fakeTeamQuery) UpdateTeam(_ context.Context, actor sharedauth.Actor, teamID int64, name string, description *string, status domain.TeamStatus) (domain.Team, error) {
	f.receivedActor = actor
	f.receivedTeamID = teamID
	f.team.Name = name
	f.team.Description = description
	f.team.Status = status
	return f.team, f.err
}

func (f *fakeTeamQuery) DeleteTeam(_ context.Context, actor sharedauth.Actor, teamID int64) error {
	f.receivedActor = actor
	f.receivedTeamID = teamID
	return f.err
}
