package teamhttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/ports"
)

func newAppSelfRouter(self AppTeamSelfCommands) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	NewAppSelfHandler(self).RegisterRoutes(group)
	return router
}

func doAppSelf(router *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Authorization", "Bearer user-token")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func TestAppSelfRoutesForwardParamsAndShapeResponses(t *testing.T) {
	self := &fakeAppSelfCommands{}
	router := newAppSelfRouter(self)

	response := doAppSelf(router, http.MethodPost, "/teams", `{"name":"东安联队","join_password":"123456"}`)
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"code":0`)) {
		t.Fatalf("create team: status=%d body=%s", response.Code, response.Body.String())
	}
	if self.createName != "东安联队" || self.createPassword == nil || *self.createPassword != "123456" || self.actor.ID != 42 {
		t.Fatalf("create not forwarded: %+v", self)
	}

	response = doAppSelf(router, http.MethodPost, "/teams/join", `{"team_id":9,"password":"8888"}`)
	if response.Code != http.StatusOK {
		t.Fatalf("join team: status=%d body=%s", response.Code, response.Body.String())
	}
	if self.joinTeamID != 9 || self.joinPassword == nil || *self.joinPassword != "8888" {
		t.Fatalf("join not forwarded: %+v", self)
	}

	response = doAppSelf(router, http.MethodGet, "/teams/search?keyword=东安", "")
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"member_count":12`)) {
		t.Fatalf("search teams: status=%d body=%s", response.Code, response.Body.String())
	}
	if self.searchKeyword != "东安" {
		t.Fatalf("search keyword not forwarded: %q", self.searchKeyword)
	}

	response = doAppSelf(router, http.MethodGet, "/teams/9/password-info", "")
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"team_id":9,"requires_password":true`)) {
		t.Fatalf("password info: status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestAppSelfRoutesMapBusinessErrors(t *testing.T) {
	router := newAppSelfRouter(&fakeAppSelfCommands{err: sharederror.New(sharederror.KindConflict, "球队名称已存在")})

	response := doAppSelf(router, http.MethodPost, "/teams", `{"name":"重复"}`)
	if response.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", response.Code, response.Body.String())
	}

	response = doAppSelf(router, http.MethodPost, "/teams/join", `{"team_id":0}`)
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 for invalid team id, got %d: %s", response.Code, response.Body.String())
	}

	response = doAppSelf(router, http.MethodGet, "/teams/not-a-number/password-info", "")
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 for invalid team id, got %d: %s", response.Code, response.Body.String())
	}
}

type fakeAppSelfCommands struct {
	err            error
	actor          sharedauth.Actor
	createName     string
	createPassword *string
	joinTeamID     int64
	joinPassword   *string
	searchKeyword  string
}

func (f *fakeAppSelfCommands) CreateTeam(_ context.Context, actor sharedauth.Actor, name string, _ *string, joinPassword *string) (domain.Team, error) {
	f.actor, f.createName, f.createPassword = actor, name, joinPassword
	if f.err != nil {
		return domain.Team{}, f.err
	}
	return domain.Team{ID: 7, Name: name, Status: domain.TeamActive}, nil
}

func (f *fakeAppSelfCommands) JoinTeam(_ context.Context, _ sharedauth.Actor, teamID int64, password *string) error {
	f.joinTeamID, f.joinPassword = teamID, password
	return f.err
}

func (f *fakeAppSelfCommands) SearchTeams(_ context.Context, keyword string) ([]ports.AppTeamSummary, error) {
	f.searchKeyword = keyword
	if f.err != nil {
		return nil, f.err
	}
	return []ports.AppTeamSummary{{Team: domain.Team{ID: 9, Name: "东安联队", Status: domain.TeamActive}, MemberCount: 12}}, nil
}

func (f *fakeAppSelfCommands) RequiresJoinPassword(_ context.Context, _ int64) (bool, error) {
	return true, f.err
}
