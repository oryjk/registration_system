package teamhttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

func TestAppManageRoutesForwardParamsAndReturnEmptyEnvelope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	manage := &fakeAppManageCommands{}
	handler := NewAppManageHandler(manage)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	handler.RegisterRoutes(group)

	do := func(method, path, body string) *httptest.ResponseRecorder {
		request := httptest.NewRequest(method, path, strings.NewReader(body))
		request.Header.Set("Authorization", "Bearer user-token")
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		return response
	}

	// 小程序会多传 jersey_number/is_member，Go 端忽略即可。
	response := do(http.MethodPatch, "/teams/7", `{"name":"东安联队","logo_url":"","jersey_number":9,"is_member":true}`)
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"code":0`)) {
		t.Fatalf("update team: status=%d body=%s", response.Code, response.Body.String())
	}
	if manage.teamID != 7 || manage.actor.ID != 42 || manage.name == nil || *manage.name != "东安联队" {
		t.Fatalf("profile not forwarded: %+v", manage)
	}
	if manage.logoURL == nil || *manage.logoURL != "" {
		t.Fatalf("logo_url empty string must reach service: %+v", manage)
	}

	response = do(http.MethodPost, "/teams/7/members", `{"user_id":50,"role":"vice_captain"}`)
	if response.Code != http.StatusOK {
		t.Fatalf("add member: status=%d body=%s", response.Code, response.Body.String())
	}
	if manage.addedUserID != 50 || manage.addedRole != domain.RoleViceCaptain {
		t.Fatalf("add member not forwarded: %+v", manage)
	}

	response = do(http.MethodPatch, "/teams/7/members/50", `{"status":"inactive"}`)
	if response.Code != http.StatusOK {
		t.Fatalf("update member: status=%d body=%s", response.Code, response.Body.String())
	}
	if manage.updatedUserID != 50 || manage.updatedRole != nil || manage.updatedStatus == nil || *manage.updatedStatus != domain.MemberInactive {
		t.Fatalf("update member not forwarded: %+v", manage)
	}

	response = do(http.MethodDelete, "/teams/7/members/50", "")
	if response.Code != http.StatusOK {
		t.Fatalf("remove member: status=%d body=%s", response.Code, response.Body.String())
	}
	if manage.removedUserID != 50 {
		t.Fatalf("remove member not forwarded: %+v", manage)
	}

	response = do(http.MethodDelete, "/teams/7", "")
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"code":0`)) {
		t.Fatalf("delete team: status=%d body=%s", response.Code, response.Body.String())
	}
	if manage.deleteTeamID != 7 {
		t.Fatalf("delete team not forwarded: %+v", manage)
	}

	manage.blockers = domain.DissolveBlockers{
		Matches:      []domain.DissolveBlockerMatch{{ID: uuid.MustParse("11111111-1111-1111-1111-111111111111"), Name: "周五友谊赛", Status: "registering", IsHost: true}},
		Applications: []domain.DissolveBlockerApplication{{ID: uuid.MustParse("22222222-2222-2222-2222-222222222222"), MatchID: uuid.MustParse("33333333-3333-3333-3333-333333333333"), MatchName: "周六约队", Status: "pending"}},
	}
	response = do(http.MethodGet, "/teams/7/dissolve-blockers", "")
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"code":0`)) {
		t.Fatalf("dissolve blockers: status=%d body=%s", response.Code, response.Body.String())
	}
	if manage.blockersTeamID != 7 {
		t.Fatalf("dissolve blockers not forwarded: %+v", manage)
	}
	body := response.Body.String()
	for _, fragment := range []string{`"is_host":true`, "周五友谊赛", "周六约队", "pending", "22222222-2222-2222-2222-222222222222"} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("dissolve blockers response missing %s: %s", fragment, body)
		}
	}

	response = do(http.MethodPut, "/teams/7/join-password", `{"join_password":"  pass123 "}`)
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"code":0`)) {
		t.Fatalf("update join password: status=%d body=%s", response.Code, response.Body.String())
	}
	if manage.joinPasswordTeamID != 7 || manage.joinPassword != "  pass123 " {
		t.Fatalf("join password not forwarded raw: %+v", manage)
	}
}

func TestAppManageRoutesMapBusinessErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	manage := &fakeAppManageCommands{err: sharederror.ErrForbidden}
	handler := NewAppManageHandler(manage)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	handler.RegisterRoutes(group)

	request := httptest.NewRequest(http.MethodDelete, "/teams/7/members/50", nil)
	request.Header.Set("Authorization", "Bearer user-token")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", response.Code, response.Body.String())
	}

	request = httptest.NewRequest(http.MethodPatch, "/teams/not-a-number", strings.NewReader(`{}`))
	request.Header.Set("Authorization", "Bearer user-token")
	request.Header.Set("Content-Type", "application/json")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 for invalid team id, got %d: %s", response.Code, response.Body.String())
	}

	request = httptest.NewRequest(http.MethodPut, "/teams/7/join-password", strings.NewReader(`not-json`))
	request.Header.Set("Authorization", "Bearer user-token")
	request.Header.Set("Content-Type", "application/json")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 for invalid join password body, got %d: %s", response.Code, response.Body.String())
	}
}

type fakeAppManageCommands struct {
	err                error
	actor              sharedauth.Actor
	teamID             int64
	name               *string
	description        *string
	logoURL            *string
	addedUserID        int64
	addedRole          domain.Role
	updatedUserID      int64
	updatedRole        *domain.Role
	updatedStatus      *domain.MemberStatus
	removedUserID      int64
	joinPassword       string
	joinPasswordTeamID int64
	deleteTeamID       int64
	blockers           domain.DissolveBlockers
	blockersTeamID     int64
}

func (f *fakeAppManageCommands) UpdateProfile(_ context.Context, actor sharedauth.Actor, teamID int64, name, description, logoURL *string) error {
	f.actor, f.teamID, f.name, f.description, f.logoURL = actor, teamID, name, description, logoURL
	return f.err
}

func (f *fakeAppManageCommands) UpdateJoinPassword(_ context.Context, actor sharedauth.Actor, teamID int64, joinPassword string) error {
	f.actor, f.joinPasswordTeamID, f.joinPassword = actor, teamID, joinPassword
	return f.err
}

func (f *fakeAppManageCommands) AddMember(_ context.Context, actor sharedauth.Actor, teamID, userID int64, role domain.Role) error {
	f.actor, f.teamID, f.addedUserID, f.addedRole = actor, teamID, userID, role
	return f.err
}

func (f *fakeAppManageCommands) UpdateMember(_ context.Context, actor sharedauth.Actor, teamID, userID int64, role *domain.Role, status *domain.MemberStatus) error {
	f.actor, f.teamID, f.updatedUserID, f.updatedRole, f.updatedStatus = actor, teamID, userID, role, status
	return f.err
}

func (f *fakeAppManageCommands) RemoveMember(_ context.Context, actor sharedauth.Actor, teamID, userID int64) error {
	f.actor, f.teamID, f.removedUserID = actor, teamID, userID
	return f.err
}

func (f *fakeAppManageCommands) DeleteTeam(_ context.Context, actor sharedauth.Actor, teamID int64) error {
	f.actor, f.deleteTeamID = actor, teamID
	return f.err
}

func (f *fakeAppManageCommands) UploadTeamLogo(_ context.Context, _ sharedauth.Actor, _ int64, _, _ string, _ []byte) (string, error) {
	return "", nil
}

func (f *fakeAppManageCommands) DissolveBlockers(_ context.Context, actor sharedauth.Actor, teamID int64) (domain.DissolveBlockers, error) {
	f.actor, f.blockersTeamID = actor, teamID
	return f.blockers, f.err
}
