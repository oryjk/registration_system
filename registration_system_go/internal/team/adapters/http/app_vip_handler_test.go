package teamhttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

func TestAppVipHandlerGetStatusAndListShareBackgrounds(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := time.Date(2026, 11, 23, 12, 0, 0, 0, time.UTC)
	vipUntil := now.Add(30 * 24 * time.Hour)
	service := &fakeAppTeamVipQueries{
		statusView: application.VipStatusView{
			TeamID:            7,
			IsVip:             true,
			VipUntil:          &vipUntil,
			VipCredits:        3,
			DefaultShareBgURL: "https://cdn.example.com/bg1.jpg",
			Plans:             domain.VipPlanCatalog(),
			Benefits:          domain.VipBenefitCatalog(),
			FreeTierNote:      domain.VipFreeTierNote,
		},
		bgView: application.ShareBackgroundListView{
			Items: []domain.ShareBackground{
				{ID: 11, TeamID: 7, ImageURL: "https://cdn.example.com/bg1.jpg", CreatedAt: now},
			},
			DefaultImageURL: "https://cdn.example.com/bg1.jpg",
		},
	}

	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	NewAppVipHandler(service).RegisterRoutes(group)

	// GET /teams/:id/vip
	req := httptest.NewRequest(http.MethodGet, "/teams/7/vip", nil)
	req.Header.Set("Authorization", "Bearer user-token")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	if resp.Code != http.StatusOK {
		t.Fatalf("GET /teams/7/vip status=%d body=%s", resp.Code, resp.Body.String())
	}
	var vipBody struct {
		Code int                `json:"code"`
		Data AppTeamVipResponse `json:"data"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &vipBody); err != nil {
		t.Fatal(err)
	}
	if vipBody.Code != 0 || vipBody.Data.TeamID != 7 || !vipBody.Data.IsVip || vipBody.Data.VipCredits != 3 ||
		len(vipBody.Data.Plans) != 3 || vipBody.Data.FreeTierNote != domain.VipFreeTierNote {
		t.Fatalf("unexpected vip response: %+v", vipBody)
	}
	if service.actor.ID != 42 || service.teamID != 7 {
		t.Fatalf("actor/team not forwarded: actor=%+v team=%d", service.actor, service.teamID)
	}

	// GET /teams/:id/share-backgrounds
	req = httptest.NewRequest(http.MethodGet, "/teams/7/share-backgrounds", nil)
	req.Header.Set("Authorization", "Bearer user-token")
	resp = httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	if resp.Code != http.StatusOK {
		t.Fatalf("GET /teams/7/share-backgrounds status=%d body=%s", resp.Code, resp.Body.String())
	}
	var bgBody struct {
		Code int                            `json:"code"`
		Data AppShareBackgroundListResponse `json:"data"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &bgBody); err != nil {
		t.Fatal(err)
	}
	if bgBody.Code != 0 || len(bgBody.Data.Items) != 1 || bgBody.Data.Items[0].ID != 11 ||
		bgBody.Data.DefaultImageURL != "https://cdn.example.com/bg1.jpg" {
		t.Fatalf("unexpected share backgrounds response: %+v", bgBody)
	}

	// 非法 teamID 返回 422。
	req = httptest.NewRequest(http.MethodGet, "/teams/invalid/vip", nil)
	req.Header.Set("Authorization", "Bearer user-token")
	resp = httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	if resp.Code != http.StatusUnprocessableEntity {
		t.Fatalf("invalid id status=%d, want 422", resp.Code)
	}

	// 权限拒绝返回 403。
	service.err = sharederror.ErrForbidden
	req = httptest.NewRequest(http.MethodGet, "/teams/7/share-backgrounds", nil)
	req.Header.Set("Authorization", "Bearer user-token")
	resp = httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	if resp.Code != http.StatusForbidden {
		t.Fatalf("forbidden status=%d, want 403", resp.Code)
	}
}

type fakeAppTeamVipQueries struct {
	actor      sharedauth.Actor
	teamID     int64
	statusView application.VipStatusView
	bgView     application.ShareBackgroundListView
	err        error
}

func (f *fakeAppTeamVipQueries) GetStatus(_ context.Context, actor sharedauth.Actor, teamID int64) (application.VipStatusView, error) {
	f.actor, f.teamID = actor, teamID
	if f.err != nil {
		return application.VipStatusView{}, f.err
	}
	return f.statusView, nil
}

func (f *fakeAppTeamVipQueries) ListShareBackgrounds(_ context.Context, actor sharedauth.Actor, teamID int64) (application.ShareBackgroundListView, error) {
	f.actor, f.teamID = actor, teamID
	if f.err != nil {
		return application.ShareBackgroundListView{}, f.err
	}
	return f.bgView, nil
}
