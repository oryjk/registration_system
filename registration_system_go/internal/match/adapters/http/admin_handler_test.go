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

func TestAdminUpdateDecodesRegistrationWindowTriState(t *testing.T) {
	gin.SetMode(gin.TestMode)
	matchID := uuid.New()
	replacement := time.Date(2026, 8, 20, 8, 0, 0, 0, time.UTC)
	tests := []struct {
		name      string
		fields    string
		wantStart application.OptionalTimestamp
		wantEnd   application.OptionalTimestamp
	}{
		{name: "omitted"},
		{name: "null", fields: `,"registration_start_at":null`, wantStart: application.OptionalTimestamp{Set: true}},
		{name: "timestamp", fields: `,"registration_end_at":"2026-08-20T08:00:00Z"`, wantEnd: application.OptionalTimestamp{Set: true, Value: &replacement}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := &fakeAdminMatches{detail: application.AdminMatchDetail{Item: ports.AdminMatchItem{Match: domain.Match{ID: matchID}}}}
			handler := NewAdminHandler(service, &fakeCreateMatch{})
			router := gin.New()
			router.PUT("/matches/:id", authhttp.NewMiddleware(fakeAdminTokens{}).RequireAdmin(), handler.Update)
			body := `{"name":"周末比赛","start_time":"2026-08-22T10:00:00Z","end_time":"2026-08-22T12:00:00Z","location":"滨江球场"` + tt.fields + `}`
			request := httptest.NewRequest(http.MethodPut, "/matches/"+matchID.String(), bytes.NewBufferString(body))
			request.Header.Set("Authorization", "Bearer admin-token")
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != http.StatusOK {
				t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
			}
			assertOptionalTimestamp(t, service.update.RegistrationStartAt, tt.wantStart)
			assertOptionalTimestamp(t, service.update.RegistrationEndAt, tt.wantEnd)
		})
	}
}

func TestAdminUpdateDecodesHostCapacityLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	limit := 12
	tests := []struct {
		name   string
		fields string
		want   *int
	}{
		{name: "omitted keeps nil", want: nil},
		{name: "null keeps nil", fields: `,"host_capacity_limit":null`, want: nil},
		{name: "number is passed through", fields: `,"host_capacity_limit":12`, want: &limit},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matchID := uuid.New()
			service := &fakeAdminMatches{detail: application.AdminMatchDetail{Item: ports.AdminMatchItem{Match: domain.Match{ID: matchID}}}}
			handler := NewAdminHandler(service, &fakeCreateMatch{})
			router := gin.New()
			router.PUT("/matches/:id", authhttp.NewMiddleware(fakeAdminTokens{}).RequireAdmin(), handler.Update)
			body := `{"name":"周四友谊赛","start_time":"2026-08-22T12:00:00Z","end_time":"2026-08-22T14:00:00Z","location":"驿马河"` + tt.fields + `}`
			request := httptest.NewRequest(http.MethodPut, "/matches/"+matchID.String(), bytes.NewBufferString(body))
			request.Header.Set("Authorization", "Bearer admin-token")
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != http.StatusOK {
				t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
			}
			got := service.update.HostCapacityLimit
			if (got == nil) != (tt.want == nil) || (got != nil && *got != *tt.want) {
				t.Fatalf("unexpected capacity: got=%v want=%v", got, tt.want)
			}
		})
	}
}

func TestAdminUpdateMatchJerseyColorThreeStates(t *testing.T) {
	gin.SetMode(gin.TestMode)
	matchID := uuid.New()
	service := &fakeAdminMatches{detail: application.AdminMatchDetail{
		Item: ports.AdminMatchItem{Match: domain.Match{ID: matchID, Name: "周四友谊赛", HostTeamID: int64Pointer(7)}, HostTeamName: "洺悦御府"},
	}}
	handler := NewAdminHandler(service, &fakeCreateMatch{})
	router := gin.New()
	router.PATCH("/matches/:id", authhttp.NewMiddleware(fakeAdminTokens{}).RequireAdmin(), handler.Update)

	patch := func(fields string) *httptest.ResponseRecorder {
		body := `{"name":"周四友谊赛","start_time":"2026-08-22T12:00:00Z","end_time":"2026-08-22T14:00:00Z","location":"驿马河"` + fields + `}`
		request := httptest.NewRequest(http.MethodPatch, "/matches/"+matchID.String(), bytes.NewBufferString(body))
		request.Header.Set("Authorization", "Bearer admin-token")
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		return response
	}

	// 状态一：传值 → 命令携带原始值，回显领域归一化后的小写结果。
	service.detail.Item.Match.HostColor = "#ff0000"
	service.detail.Item.Match.AwayColor = "#00ff00"
	response := patch(`,"host_color":"#FF0000","away_color":"#00FF00"`)
	if response.Code != http.StatusOK {
		t.Fatalf("unexpected set response %d: %s", response.Code, response.Body.String())
	}
	assertStringPointer(t, service.update.HostColor, "#FF0000")
	assertStringPointer(t, service.update.AwayColor, "#00FF00")
	if !bytes.Contains(response.Body.Bytes(), []byte(`"host_color":"#ff0000"`)) ||
		!bytes.Contains(response.Body.Bytes(), []byte(`"away_color":"#00ff00"`)) {
		t.Fatalf("set response missing normalized colors: %s", response.Body.String())
	}

	// 状态二：传空串 → 清除，回显 null；未携带的 away_color 保持不变。
	service.detail.Item.Match.HostColor = ""
	response = patch(`,"host_color":""`)
	if response.Code != http.StatusOK {
		t.Fatalf("unexpected clear response %d: %s", response.Code, response.Body.String())
	}
	assertStringPointer(t, service.update.HostColor, "")
	if service.update.AwayColor != nil {
		t.Fatalf("omitted away_color must stay nil, got %q", *service.update.AwayColor)
	}
	if !bytes.Contains(response.Body.Bytes(), []byte(`"host_color":null`)) {
		t.Fatalf("clear response must echo null host_color: %s", response.Body.String())
	}

	// 状态三：不带字段 → 本次不修改，值保持 null（未设置）。
	response = patch(``)
	if response.Code != http.StatusOK {
		t.Fatalf("unexpected keep response %d: %s", response.Code, response.Body.String())
	}
	if service.update.HostColor != nil || service.update.AwayColor != nil {
		t.Fatalf("omitted jersey colors must stay nil: %+v", service.update)
	}
	if !bytes.Contains(response.Body.Bytes(), []byte(`"host_color":null`)) {
		t.Fatalf("keep response must keep host_color null: %s", response.Body.String())
	}
}

func assertStringPointer(t *testing.T, got *string, want string) {
	t.Helper()
	if got == nil || *got != want {
		t.Fatalf("unexpected string pointer: got=%v want=%q", got, want)
	}
}

func assertOptionalTimestamp(t *testing.T, got, want application.OptionalTimestamp) {
	t.Helper()
	if got.Set != want.Set {
		t.Fatalf("unexpected set flag: got=%v want=%v", got.Set, want.Set)
	}
	if got.Value == nil || want.Value == nil {
		if got.Value != nil || want.Value != nil {
			t.Fatalf("unexpected value: got=%v want=%v", got.Value, want.Value)
		}
		return
	}
	if !got.Value.Equal(*want.Value) {
		t.Fatalf("unexpected value: got=%s want=%s", got.Value, want.Value)
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
	update    application.UpdateMatchCommand
	deletedID uuid.UUID
}

func (f *fakeAdminMatches) List(context.Context, sharedauth.Actor, application.AdminMatchListQuery) (application.AdminMatchListResult, error) {
	return f.list, nil
}
func (f *fakeAdminMatches) Get(context.Context, sharedauth.Actor, uuid.UUID) (application.AdminMatchDetail, error) {
	return f.detail, nil
}
func (f *fakeAdminMatches) UpdateDetails(_ context.Context, _ sharedauth.Actor, _ uuid.UUID, command application.UpdateMatchCommand) (domain.Match, error) {
	f.update = command
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
