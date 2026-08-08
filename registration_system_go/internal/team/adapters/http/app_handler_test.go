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
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

func TestAppTeamRoutesReturnPrivacyDTOs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := time.Date(2026, 8, 8, 8, 0, 0, 0, time.UTC)
	realName := "王睿"
	queries := &fakeAppTeamQueries{
		detail:  application.AppTeamDetail{Team: domain.Team{ID: 7, Name: "东安联队", Status: domain.TeamActive}, MyRole: domain.RoleLeader},
		members: []application.AppTeamMember{{UserID: 42, Nickname: "阿睿", RealName: &realName, Role: domain.RoleLeader, Status: domain.MemberActive, JoinedAt: now}},
	}
	handler := NewAppHandler(queries)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	handler.RegisterRoutes(group)

	for _, test := range []struct{ path, want string }{
		{path: "/teams/7", want: `"my_role":"leader"`},
		{path: "/teams/7/members", want: `"user_id":42`},
	} {
		response := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, test.path, nil)
		request.Header.Set("Authorization", "Bearer user-token")
		router.ServeHTTP(response, request)
		if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(test.want)) {
			t.Fatalf("%s: status=%d body=%s", test.path, response.Code, response.Body.String())
		}
		for _, forbidden := range []string{"phone_number", "openid", "member_id"} {
			if bytes.Contains(response.Body.Bytes(), []byte(forbidden)) {
				t.Fatalf("%s exposed %s: %s", test.path, forbidden, response.Body.String())
			}
		}
	}
	if queries.actor.Kind != sharedauth.ActorUser || queries.actor.ID != 42 || queries.teamID != 7 {
		t.Fatalf("actor/team not forwarded: actor=%+v team=%d", queries.actor, queries.teamID)
	}
}

type fakeUserTokens struct{}

func (fakeUserTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (fakeUserTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (fakeUserTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, nil
}

type fakeAppTeamQueries struct {
	detail  application.AppTeamDetail
	members []application.AppTeamMember
	actor   sharedauth.Actor
	teamID  int64
}

func (f *fakeAppTeamQueries) GetTeam(_ context.Context, actor sharedauth.Actor, teamID int64) (application.AppTeamDetail, error) {
	f.actor, f.teamID = actor, teamID
	return f.detail, nil
}

func (f *fakeAppTeamQueries) ListMembers(_ context.Context, actor sharedauth.Actor, teamID int64) ([]application.AppTeamMember, error) {
	f.actor, f.teamID = actor, teamID
	return f.members, nil
}
