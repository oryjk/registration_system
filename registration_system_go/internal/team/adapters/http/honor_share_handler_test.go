package teamhttp

import (
	"context"
	"encoding/json"
	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type honorCommands struct{}

func (honorCommands) Issue(context.Context, sharedauth.Actor, int64) (application.HonorShareView, error) {
	return application.HonorShareView{HonorShare: domain.HonorShare{TeamID: 11, UserID: 4, ScoreYear: 2026, Nickname: "Carl", ParticipationPoints: 2590, ParticipationRank: 4, IsPaidMember: true}, Code: "abcdefghijklmnopqrstuv", IsMember: true}, nil
}
func (honorCommands) Resolve(ctx context.Context, actor sharedauth.Actor, code string) (application.HonorShareView, error) {
	return honorCommands{}.Issue(ctx, actor, 11)
}
func (honorCommands) MiniCode(context.Context, sharedauth.Actor, string, string) (string, error) {
	return "https://example.test/code.png", nil
}
func TestHonorShareHTTPShapeAndAuthentication(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	NewHonorShareHandler(honorCommands{}).RegisterRoutes(group)
	response := doAppInvite(router, http.MethodPost, "/teams/11/honor-share", "")
	if response.Code != 200 {
		t.Fatalf("issue: %d %s", response.Code, response.Body.String())
	}
	var body struct {
		Data map[string]any `json:"data"`
	}
	_ = json.Unmarshal(response.Body.Bytes(), &body)
	if body.Data["participation_points"] != float64(259) || body.Data["year"] != float64(2026) || body.Data["code"] != "abcdefghijklmnopqrstuv" || body.Data["is_paid_member"] != true {
		t.Fatalf("wrong public view: %+v", body.Data)
	}
	if strings.Contains(response.Body.String(), "Phone") || strings.Contains(response.Body.String(), "balance") || strings.Contains(response.Body.String(), "openid") {
		t.Fatal("private fields leaked")
	}
	response = doAppInvite(router, http.MethodPost, "/honor-shares/abcdefghijklmnopqrstuv/mini-code", `{"environment":"develop"}`)
	if response.Code != 200 || !strings.Contains(response.Body.String(), "image_url") {
		t.Fatalf("mini code: %d %s", response.Code, response.Body.String())
	}
	noAuth := httptest.NewRecorder()
	router.ServeHTTP(noAuth, httptest.NewRequest("GET", "/honor-shares/abcdefghijklmnopqrstuv", nil))
	if noAuth.Code != 401 {
		t.Fatalf("anonymous lookup: %d", noAuth.Code)
	}
	response = doAppInvite(router, "POST", "/honor-shares/abcdefghijklmnopqrstuv/mini-code", "invalid")
	if response.Code != 422 {
		t.Fatalf("bad payload: %d", response.Code)
	}
}
