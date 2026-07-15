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
	handler := NewHandler(query)
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

type fakeTeamQuery struct {
	items          []domain.TeamMembership
	receivedUserID int64
	err            error
}

func (f *fakeTeamQuery) ListByUser(_ context.Context, userID int64) ([]domain.TeamMembership, error) {
	f.receivedUserID = userID
	return f.items, f.err
}

func (f *fakeTeamQuery) ListActive(context.Context) ([]domain.Team, error) {
	return nil, f.err
}

func (f *fakeTeamQuery) CreateTeam(context.Context, sharedauth.Actor, string, *string) (domain.Team, error) {
	return domain.Team{}, f.err
}
