package systemhttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/domain"
)

type fakeSettingsService struct {
	settings domain.MiniAppSettings
}

func (s *fakeSettingsService) Get(context.Context) (domain.MiniAppSettings, error) {
	return s.settings, nil
}

func (s *fakeSettingsService) UpdateDebug(_ context.Context, patch application.DebugSettingsPatch) (domain.MiniAppSettings, error) {
	if patch.ClearProfileEnabled != nil {
		s.settings.Debug.ClearProfileEnabled = *patch.ClearProfileEnabled
	}
	if patch.ReviewStatusToggleEnabled != nil {
		s.settings.Debug.ReviewStatusToggleEnabled = *patch.ReviewStatusToggleEnabled
	}
	return s.settings, nil
}

func TestGetMiniAppRuntimeConfigReturnsDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	NewHandler(&fakeSettingsService{}).RegisterPublicRoutes(router.Group("/api/v1/app"))

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
	if config.Debug.ClearProfileEnabled {
		t.Fatalf("debug section should default to off: %+v", config.Debug)
	}
}

func TestGetMiniAppRuntimeConfigOverlaysDebugSettings(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	NewHandler(&fakeSettingsService{settings: domain.MiniAppSettings{
		Debug: domain.DebugSettings{ClearProfileEnabled: true},
	}}).RegisterPublicRoutes(router.Group("/api/v1/app"))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/app/system/mini-app-runtime-config", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"clear_profile_enabled":true`) {
		t.Fatalf("expected debug flag in body: %s", recorder.Body.String())
	}
}
