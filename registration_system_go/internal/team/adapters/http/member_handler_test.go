package teamhttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

func TestAdminMemberManagementRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	realName, phoneNumber := "王小明", "13800138000"
	members := &fakeTeamMembers{result: application.MemberManagementResult{
		Team: domain.Team{ID: 7, Name: "东安联队", Status: domain.TeamActive},
		Members: []domain.MemberDetails{{
			Member:   domain.Member{ID: 3, TeamID: 7, UserID: 42, Role: domain.RoleLeader, Status: domain.MemberActive},
			Nickname: "小王",
			RealName: &realName, PhoneNumber: &phoneNumber,
		}},
	}, candidates: []domain.MemberCandidate{{UserID: 43, Nickname: "小李", RealName: &realName, PhoneNumber: &phoneNumber}}}
	handler := NewHandler(&fakeTeamQuery{}, members)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeAdminTokens{}).RequireAdmin())
	handler.RegisterAdminRoutes(group)

	tests := []struct {
		name     string
		method   string
		path     string
		body     string
		wantBody string
	}{
		{name: "list", method: http.MethodGet, path: "/teams/7/members", wantBody: `"real_name":"王小明"`},
		{name: "candidates", method: http.MethodGet, path: "/teams/7/member-candidates?search=小", wantBody: `"phone_number":"13800138000"`},
		{name: "add", method: http.MethodPost, path: "/teams/7/members", body: `{"user_id":43,"role":"member"}`, wantBody: `"name":"东安联队"`},
		{name: "update", method: http.MethodPatch, path: "/teams/7/members/42", body: `{"role":"vice_captain","status":"active"}`, wantBody: `"members"`},
		{name: "remove", method: http.MethodDelete, path: "/teams/7/members/42", wantBody: `"members"`},
		{name: "set captain", method: http.MethodPatch, path: "/teams/7/captain", body: `{"user_id":42}`, wantBody: `"team"`},
		{name: "clear captain", method: http.MethodPatch, path: "/teams/7/captain", body: `{"user_id":null}`, wantBody: `"team"`},
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
		})
	}

	if members.actor.ID != 7 || members.teamID != 7 {
		t.Fatalf("unexpected actor or team: actor=%+v team=%d", members.actor, members.teamID)
	}
	if members.search != "小" || members.addedUserID != 43 || members.updatedUserID != 42 || members.removedUserID != 42 {
		t.Fatalf("requests were not mapped: %+v", members)
	}
}

type fakeTeamMembers struct {
	result        application.MemberManagementResult
	candidates    []domain.MemberCandidate
	actor         sharedauth.Actor
	teamID        int64
	search        string
	addedUserID   int64
	updatedUserID int64
	removedUserID int64
}

func (f *fakeTeamMembers) capture(actor sharedauth.Actor, teamID int64) {
	f.actor = actor
	f.teamID = teamID
}

func (f *fakeTeamMembers) List(_ context.Context, actor sharedauth.Actor, teamID int64) (application.MemberManagementResult, error) {
	f.capture(actor, teamID)
	return f.result, nil
}

func (f *fakeTeamMembers) ListCandidates(_ context.Context, actor sharedauth.Actor, teamID int64, search string) ([]domain.MemberCandidate, error) {
	f.capture(actor, teamID)
	f.search = search
	return f.candidates, nil
}

func (f *fakeTeamMembers) Add(_ context.Context, actor sharedauth.Actor, teamID, userID int64, _ domain.Role) (application.MemberManagementResult, error) {
	f.capture(actor, teamID)
	f.addedUserID = userID
	return f.result, nil
}

func (f *fakeTeamMembers) Update(_ context.Context, actor sharedauth.Actor, teamID, userID int64, _ domain.Role, _ domain.MemberStatus) (application.MemberManagementResult, error) {
	f.capture(actor, teamID)
	f.updatedUserID = userID
	return f.result, nil
}

func (f *fakeTeamMembers) Remove(_ context.Context, actor sharedauth.Actor, teamID, userID int64) (application.MemberManagementResult, error) {
	f.capture(actor, teamID)
	f.removedUserID = userID
	return f.result, nil
}

func (f *fakeTeamMembers) SetCaptain(_ context.Context, actor sharedauth.Actor, teamID int64, _ *int64) (application.MemberManagementResult, error) {
	f.capture(actor, teamID)
	return f.result, nil
}
