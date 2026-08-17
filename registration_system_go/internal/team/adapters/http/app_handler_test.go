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
	handler := NewAppHandler(queries, nil)
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

type fakeAppAttendanceQueries struct {
	summary  application.AttendanceSummary
	records  []application.AttendanceQueryRecord
	actor    sharedauth.Actor
	teamID   int64
	targetID int64
	start    *time.Time
	end      *time.Time
}

func (f *fakeAppAttendanceQueries) MemberRecords(_ context.Context, actor sharedauth.Actor, teamID, userID int64, startDate, endDate *time.Time) ([]application.AttendanceQueryRecord, error) {
	f.actor, f.teamID, f.targetID, f.start, f.end = actor, teamID, userID, startDate, endDate
	return f.records, nil
}

func (f *fakeAppAttendanceQueries) Summary(_ context.Context, actor sharedauth.Actor, teamID int64, startDate, endDate *time.Time) (application.AttendanceSummary, error) {
	f.actor, f.teamID, f.start, f.end = actor, teamID, startDate, endDate
	return f.summary, nil
}

func TestAppTeamAttendanceRoutesMapStandAndForwardDateRange(t *testing.T) {
	gin.SetMode(gin.TestMode)
	operation := pgtypeTimestampForTest(time.Date(2026, 8, 14, 12, 0, 0, 0, time.UTC))
	attendance := &fakeAppAttendanceQueries{
		records: []application.AttendanceQueryRecord{
			{ActivityID: "m-1", ActivityName: "周四友谊赛", HoldingDate: time.Date(2026, 8, 13, 12, 0, 0, 0, time.UTC), Location: "球场", Stand: "attending", RegistrationCount: 1, OperationTime: operation, Registered: true},
			{ActivityID: "m-2", ActivityName: "未报名赛", HoldingDate: time.Date(2026, 8, 6, 12, 0, 0, 0, time.UTC), Location: "球场", Stand: "unknown", RegistrationCount: 0, Registered: false},
		},
	}
	handler := NewAppHandler(nil, attendance)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	handler.RegisterRoutes(group)

	request := httptest.NewRequest(http.MethodGet, "/teams/7/members/9/attendance?startDate=2026-08-01&endDate=2026-08-31", nil)
	request.Header.Set("Authorization", "Bearer user-token")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("unexpected member attendance response %d: %s", response.Code, response.Body.String())
	}
	body := response.Body.String()
	for _, expected := range []string{`"stand":1`, `"stand":0`, `"registered":true`, `"activity_id":"m-1"`} {
		if !bytes.Contains(response.Body.Bytes(), []byte(expected)) {
			t.Fatalf("member attendance body missing %s: %s", expected, body)
		}
	}
	if attendance.teamID != 7 || attendance.targetID != 9 || attendance.start == nil || attendance.end == nil {
		t.Fatalf("params not forwarded: %+v", attendance)
	}

	attendance.summary = application.AttendanceSummary{
		MyRecords: attendance.records[:1],
		Ranking:   []application.AttendanceQueryRankingItem{{UserID: 9, UserName: "队长", TotalCount: 3, AttendedCount: 2, UnregisteredCount: 1}},
	}
	request = httptest.NewRequest(http.MethodGet, "/teams/7/attendance-summary", nil)
	request.Header.Set("Authorization", "Bearer user-token")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("unexpected summary response %d: %s", response.Code, response.Body.String())
	}
	for _, expected := range []string{`"my_records":`, `"ranking":`, `"attended_count":2`} {
		if !bytes.Contains(response.Body.Bytes(), []byte(expected)) {
			t.Fatalf("summary body missing %s: %s", expected, response.Body.String())
		}
	}

	request = httptest.NewRequest(http.MethodGet, "/teams/7/attendance-summary?startDate=not-a-date", nil)
	request.Header.Set("Authorization", "Bearer user-token")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 for invalid date, got %d: %s", response.Code, response.Body.String())
	}
}

func pgtypeTimestampForTest(value time.Time) *time.Time {
	return &value
}
