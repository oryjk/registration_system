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

func (s *fakeSettingsService) UpdateOnboarding(_ context.Context, patch application.OnboardingSettingsPatch) (domain.MiniAppSettings, error) {
	if patch.Enabled != nil {
		s.settings.Onboarding.Enabled = *patch.Enabled
	}
	return s.settings, nil
}

func (s *fakeSettingsService) UpdateHome(_ context.Context, patch application.HomeSettingsPatch) (domain.MiniAppSettings, error) {
	if patch.NextMatchSocialImageURL != nil {
		s.settings.Home.NextMatchSocialImageURL = *patch.NextMatchSocialImageURL
	}
	return s.settings, nil
}

func TestGetMiniAppRuntimeConfigReturnsDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	NewHandler(&fakeSettingsService{}, nil).RegisterPublicRoutes(router.Group("/api/v1/app"))

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
	if config.Onboarding.Enabled {
		t.Fatalf("onboarding section should default to off: %+v", config.Onboarding)
	}
}

func TestGetMiniAppRuntimeConfigOverlaysOnboardingSettings(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	NewHandler(&fakeSettingsService{settings: domain.MiniAppSettings{
		Onboarding: domain.OnboardingSettings{Enabled: true},
	}}, nil).RegisterPublicRoutes(router.Group("/api/v1/app"))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/app/system/mini-app-runtime-config", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"onboarding":{"enabled":true}`) {
		t.Fatalf("expected onboarding flag in body: %s", recorder.Body.String())
	}
}

func TestGetMiniAppRuntimeConfigOverlaysDebugSettings(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	NewHandler(&fakeSettingsService{settings: domain.MiniAppSettings{
		Debug: domain.DebugSettings{ClearProfileEnabled: true},
	}}, nil).RegisterPublicRoutes(router.Group("/api/v1/app"))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/app/system/mini-app-runtime-config", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"clear_profile_enabled":true`) {
		t.Fatalf("expected debug flag in body: %s", recorder.Body.String())
	}
}

func TestGetMiniAppRuntimeConfigReturnsEmptyHomeImageURLByDefault(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	NewHandler(&fakeSettingsService{}, nil).RegisterPublicRoutes(router.Group("/api/v1/app"))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/app/system/mini-app-runtime-config", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"next_match_social_image_url":""`) {
		t.Fatalf("home image URL should default to empty: %s", recorder.Body.String())
	}
}

func TestGetMiniAppRuntimeConfigOverlaysHomeSettings(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	NewHandler(&fakeSettingsService{settings: domain.MiniAppSettings{
		Home: domain.HomeSettings{NextMatchSocialImageURL: "https://cdn.example.com/static/home/next-match-social/abc.png"},
	}}, nil).RegisterPublicRoutes(router.Group("/api/v1/app"))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/app/system/mini-app-runtime-config", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"next_match_social_image_url":"https://cdn.example.com/static/home/next-match-social/abc.png"`) {
		t.Fatalf("runtime config should expose configured home image URL: %s", recorder.Body.String())
	}
}

func TestGetMiniAppSettingsIncludesHomeSection(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	NewHandler(&fakeSettingsService{settings: domain.MiniAppSettings{
		Home: domain.HomeSettings{NextMatchSocialImageURL: "https://cdn.example.com/x.png"},
	}}, nil).RegisterAdminRoutes(router.Group("/api/v1/admin"))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/admin/system/mini-app-settings", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"home":{"next_match_social_image_url":"https://cdn.example.com/x.png"}`) {
		t.Fatalf("admin settings should include home section: %s", recorder.Body.String())
	}
}

func TestUpdateMiniAppSettingsAcceptsHomeSection(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service := &fakeSettingsService{}
	router := gin.New()
	NewHandler(service, nil).RegisterAdminRoutes(router.Group("/api/v1/admin"))

	request := httptest.NewRequest(http.MethodPut, "/api/v1/admin/system/mini-app-settings",
		strings.NewReader(`{"home":{"next_match_social_image_url":"https://cdn.example.com/y.png"}}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if service.settings.Home.NextMatchSocialImageURL != "https://cdn.example.com/y.png" {
		t.Fatalf("home URL should be updated: %+v", service.settings.Home)
	}
}
