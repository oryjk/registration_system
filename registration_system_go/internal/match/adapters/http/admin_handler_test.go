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

func TestAdminMatchListUsesAuthenticatedAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	matchID := uuid.New()
	service := &fakeAdminMatches{list: application.AdminMatchListResult{
		Items: []ports.AdminMatchItem{{Match: domain.Match{ID: matchID, Name: "周末比赛"}, HostTeamName: "城北联队"}}, Total: 1, Page: 1, PageSize: 20,
	}}
	handler := NewAdminHandler(service, &fakeCreateMatch{})
	router := gin.New()
	router.GET("/matches", authhttp.NewMiddleware(fakeAdminTokens{}).RequireAdmin(), handler.List)
	request := httptest.NewRequest(http.MethodGet, "/matches", nil)
	request.Header.Set("Authorization", "Bearer admin-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(matchID.String())) {
		t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
	}
}

func TestSuperAdminDeletesMatch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	matchID := uuid.New()
	service := &fakeAdminMatches{}
	handler := NewAdminHandler(service, &fakeCreateMatch{})
	router := gin.New()
	router.DELETE("/matches/:id", authhttp.NewMiddleware(fakeAdminTokens{}).RequireAdmin(), handler.Delete)
	request := httptest.NewRequest(http.MethodDelete, "/matches/"+matchID.String(), nil)
	request.Header.Set("Authorization", "Bearer admin-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK || service.deletedID != matchID {
		t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
	}
}

func TestAdminMatchDetailIncludesRosterRegistrations(t *testing.T) {
	gin.SetMode(gin.TestMode)
	matchID := uuid.New()
	groupID := uuid.New()
	teamID := int64(11)
	attending := domain.RegistrationAttending
	captain := "captain"
	service := &fakeAdminMatches{detail: application.AdminMatchDetail{
		Item:   ports.AdminMatchItem{Match: domain.Match{ID: matchID, Name: "周四友谊赛"}, HostTeamName: "洺悦御府"},
		Groups: []domain.RegistrationGroup{{ID: groupID, MatchID: matchID, Kind: domain.GroupHostTeam, TeamID: &teamID, Status: domain.GroupOpen}},
		Rosters: []application.AdminGroupRoster{{GroupID: groupID, Entries: []ports.AdminRosterEntry{
			{UserID: 38, Nickname: "东安利马", MemberRole: &captain, Status: &attending},
			{UserID: 40, Nickname: "阿东", MemberRole: nil, Status: nil},
		}}},
	}}
	handler := NewAdminHandler(service, &fakeCreateMatch{})
	router := gin.New()
	router.GET("/matches/:id", authhttp.NewMiddleware(fakeAdminTokens{}).RequireAdmin(), handler.Get)
	request := httptest.NewRequest(http.MethodGet, "/matches/"+matchID.String(), nil)
	request.Header.Set("Authorization", "Bearer admin-token")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
	}
	for _, expected := range []string{`"registrations"`, `"user_id":38`, `"status":"attending"`, `"user_id":40`, `"status":"unregistered"`} {
		if !bytes.Contains(response.Body.Bytes(), []byte(expected)) {
			t.Fatalf("expected %s in response: %s", expected, response.Body.String())
		}
	}
}

type fakeAdminTokens struct{}

func (fakeAdminTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (fakeAdminTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (fakeAdminTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 7, IsSuperAdmin: true}, nil
}

type fakeAdminMatches struct {
	list      application.AdminMatchListResult
	detail    application.AdminMatchDetail
	deletedID uuid.UUID
}

func (f *fakeAdminMatches) List(context.Context, sharedauth.Actor, application.AdminMatchListQuery) (application.AdminMatchListResult, error) {
	return f.list, nil
}
func (f *fakeAdminMatches) Get(context.Context, sharedauth.Actor, uuid.UUID) (application.AdminMatchDetail, error) {
	return f.detail, nil
}
func (f *fakeAdminMatches) UpdateDetails(context.Context, sharedauth.Actor, uuid.UUID, domain.UpdateMatchDetails) (domain.Match, error) {
	return domain.Match{}, nil
}
func (f *fakeAdminMatches) ChangeStatus(context.Context, sharedauth.Actor, uuid.UUID, domain.MatchStatus) (domain.Match, error) {
	return domain.Match{}, nil
}
func (f *fakeAdminMatches) Delete(_ context.Context, _ sharedauth.Actor, id uuid.UUID) error {
	f.deletedID = id
	return nil
}

type fakeCreateMatch struct{}

func (f *fakeCreateMatch) Execute(context.Context, sharedauth.Actor, application.CreateMatchCommand) (application.CreateMatchResult, error) {
	return application.CreateMatchResult{}, nil
}
