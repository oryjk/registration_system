package systemhttp

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	jwtadapter "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/jwt"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/application"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func readHome(t *testing.T, response *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var envelope struct {
		Data struct {
			Home map[string]any `json:"home"`
		} `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	return envelope.Data.Home
}

func TestOnboardingUploadsPersistEachSceneWithoutResettingOthers(t *testing.T) {
	repo := &uploadFakeRepo{sections: map[string]map[string]any{"home": {"next_match_social_image_url": "legacy"}}}
	store := &uploadFakeStore{}
	router := newUploadRouter(t, store, repo)
	NewHandler(application.NewSettingsService(repo), nil).RegisterPublicRoutes(router.Group("/api/v1/app"))
	for _, scene := range []string{"welcome", "team", "match"} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, multipartUploadRequest("/api/v1/admin/system/mini-app-settings/home/onboarding-images/"+scene, "image/png", "scene.png", validPNG()))
		home := readHome(t, response)
		if !strings.HasPrefix(store.savedKey, "static/home/onboarding/"+scene+"/") {
			t.Fatalf("uncontrolled key: %s", store.savedKey)
		}
		if home["onboarding_"+scene+"_image_url"] != "https://cdn.example.com/"+store.savedKey {
			t.Fatalf("missing URL: %+v", home)
		}
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/app/system/mini-app-runtime-config", nil))
	home := readHome(t, response)
	for _, scene := range []string{"welcome", "team", "match"} {
		if !strings.HasPrefix(fmt.Sprint(home["onboarding_"+scene+"_image_url"]), "https://cdn.example.com/static/home/onboarding/"+scene+"/") {
			t.Fatalf("missing runtime URL: %+v", home)
		}
	}
	if home["next_match_social_image_url"] != "legacy" {
		t.Fatalf("legacy field reset: %+v", home)
	}
}

func TestOnboardingUploadRejectsInvalidInput(t *testing.T) {
	for _, tc := range []struct {
		name, scene string
		data        []byte
	}{
		{"scene", "unknown", validPNG()}, {"format", "welcome", []byte("<svg/>")}, {"empty", "team", nil}, {"oversize", "match", make([]byte, application.MaxHomeAssetUploadBytes+1)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := &uploadFakeStore{}
			repo := &uploadFakeRepo{sections: map[string]map[string]any{}}
			router := newUploadRouter(t, store, repo)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, multipartUploadRequest("/api/v1/admin/system/mini-app-settings/home/onboarding-images/"+tc.scene, "image/png", "file.png", tc.data))
			if response.Code != http.StatusUnprocessableEntity {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
			if store.savedCount != 0 || len(repo.sections) != 0 {
				t.Fatal("invalid upload had side effects")
			}
		})
	}
}

func TestOnboardingSettingsPartialUpdateClearAndLegacyClient(t *testing.T) {
	repo := &uploadFakeRepo{sections: map[string]map[string]any{}}
	router := newUploadRouter(t, &uploadFakeStore{}, repo)
	expected := map[string]any{"next_match_social_image_url": "", "onboarding_welcome_image_url": "", "onboarding_team_image_url": "", "onboarding_match_image_url": ""}
	for _, field := range []string{"onboarding_welcome_image_url", "onboarding_team_image_url", "onboarding_match_image_url", "next_match_social_image_url", "onboarding_team_image_url"} {
		value := field + ".png"
		if expected[field] != "" {
			value = ""
		}
		expected[field] = value
		response := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPut, "/api/v1/admin/system/mini-app-settings", strings.NewReader(fmt.Sprintf(`{"home":{%q:%q}}`, field, "  "+value+"  ")))
		request.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(response, request)
		home := readHome(t, response)
		for key, want := range expected {
			if home[key] != want {
				t.Fatalf("%s got %v want %v", key, home[key], want)
			}
		}
	}
}

func TestOnboardingUploadRequiresAdmin(t *testing.T) {
	tokens, err := jwtadapter.NewService("test-secret-for-onboarding-assets", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	userToken, err := tokens.IssueUser(context.Background(), 1)
	if err != nil {
		t.Fatal(err)
	}
	adminToken, err := tokens.IssueAdmin(context.Background(), 1, false)
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		token  string
		status int
	}{{"", http.StatusUnauthorized}, {userToken, http.StatusForbidden}, {adminToken, http.StatusOK}} {
		store := &uploadFakeStore{}
		repo := &uploadFakeRepo{sections: map[string]map[string]any{}}
		settings := application.NewSettingsService(repo)
		router := gin.New()
		group := router.Group("/api/v1/admin", authhttp.NewMiddleware(tokens).RequireAdmin())
		NewHandler(settings, application.NewHomeAssetService(store, settings)).RegisterAdminRoutes(group)
		response := httptest.NewRecorder()
		request := multipartUploadRequest("/api/v1/admin/system/mini-app-settings/home/onboarding-images/welcome", "image/png", "x.png", validPNG())
		if tc.token != "" {
			request.Header.Set("Authorization", "Bearer "+tc.token)
		}
		router.ServeHTTP(response, request)
		if response.Code != tc.status {
			t.Fatalf("status=%d want=%d", response.Code, tc.status)
		}
		if tc.status != http.StatusOK && (store.savedCount != 0 || len(repo.sections) != 0) {
			t.Fatal("unauthorized upload had side effects")
		}
	}
}
