package teamhttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/application"
)

type fakeAppInviteCommands struct {
	issueTeamID  int64
	resolveCode  string
	resolveErr   error
	resolveView  application.AppTeamInviteView
	issueErr     error
	issueCode    string
	issueExpires time.Time
}

func (f *fakeAppInviteCommands) Issue(_ context.Context, _ sharedauth.Actor, teamID int64) (string, time.Time, error) {
	f.issueTeamID = teamID
	return f.issueCode, f.issueExpires, f.issueErr
}

func (f *fakeAppInviteCommands) Resolve(_ context.Context, _ sharedauth.Actor, code string) (application.AppTeamInviteView, error) {
	f.resolveCode = code
	return f.resolveView, f.resolveErr
}

func newAppInviteRouter(invites AppTeamInviteCommands) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	NewAppInviteHandler(invites).RegisterRoutes(group)
	return router
}

func doAppInvite(router *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Authorization", "Bearer user-token")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func TestAppInviteRoutesForwardParamsAndShapeResponses(t *testing.T) {
	expires := time.Date(2026, 9, 7, 12, 0, 0, 0, time.UTC)
	invites := &fakeAppInviteCommands{
		issueCode:    "7.1234567890.AQID",
		issueExpires: expires,
		resolveView: application.AppTeamInviteView{
			TeamID: 7, Name: "东安联队", RequiresPassword: true,
		},
	}
	router := newAppInviteRouter(invites)

	response := doAppInvite(router, http.MethodGet, "/teams/7/invite-code", "")
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"code":"7.1234567890.AQID"`)) {
		t.Fatalf("issue: status=%d body=%s", response.Code, response.Body.String())
	}
	if invites.issueTeamID != 7 {
		t.Fatalf("issue team id not forwarded: %d", invites.issueTeamID)
	}

	response = doAppInvite(router, http.MethodPost, "/teams/invites/resolve", `{"code":"7.1234567890.AQID"}`)
	if response.Code != http.StatusOK ||
		!bytes.Contains(response.Body.Bytes(), []byte(`"team_id":7`)) ||
		!bytes.Contains(response.Body.Bytes(), []byte(`"requires_password":true`)) ||
		!bytes.Contains(response.Body.Bytes(), []byte(`"is_member":false`)) {
		t.Fatalf("resolve: status=%d body=%s", response.Code, response.Body.String())
	}
	if invites.resolveCode != "7.1234567890.AQID" {
		t.Fatalf("resolve code not forwarded: %q", invites.resolveCode)
	}
}

func TestAppInviteRoutesRejectInvalidInput(t *testing.T) {
	invites := &fakeAppInviteCommands{resolveErr: sharederror.ErrForbidden}
	router := newAppInviteRouter(invites)

	response := doAppInvite(router, http.MethodPost, "/teams/invites/resolve", `{"code":""}`)
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("empty code: status=%d body=%s", response.Code, response.Body.String())
	}

	response = doAppInvite(router, http.MethodPost, "/teams/invites/resolve", `{"code":"bad"}`)
	if response.Code != http.StatusForbidden {
		t.Fatalf("invalid code: status=%d body=%s", response.Code, response.Body.String())
	}
}
