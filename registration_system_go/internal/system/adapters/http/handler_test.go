package systemhttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestGetMiniAppRuntimeConfigReturnsDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	NewHandler().RegisterPublicRoutes(router.Group("/api/v1/app"))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/app/system/mini-app-runtime-config", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload struct {
		Code int                          `json:"code"`
		Data MiniAppRuntimeConfigResponse `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Code != 0 {
		t.Fatalf("code=%d", payload.Code)
	}
	config := payload.Data
	if config.Home.MatchCardLimit != 2 || !config.Home.HideMatchesAfterHoldingTime || len(config.Home.HeroBanners) != 1 {
		t.Fatalf("home section mismatch: %+v", config.Home)
	}
	if config.Matches.ParticipantAvatarLimit != 5 || config.Checkin.DefaultRadiusMeters != 200 {
		t.Fatalf("matches/checkin mismatch: %+v %+v", config.Matches, config.Checkin)
	}
	if config.Billing.RecentOrderLimit != 10 || config.Notifications.ListLimit != 50 || config.Profile.RequirePhoneBinding {
		t.Fatalf("billing/notifications/profile mismatch: %+v", config)
	}
}
