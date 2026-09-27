package systemhttp

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/adapters/postgres"
	systemapplication "github.com/oryjk/registration_system/registration_system_go/internal/system/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

// flowFakeStore 让集成测试走真实 PG 持久化，仅对象存储用内存替身。
type flowFakeStore struct{}

func (flowFakeStore) Save(_ context.Context, key, _ string, _ []byte) (string, error) {
	return fmt.Sprintf("https://cdn.example.com/%s", key), nil
}

func newSettingsRouter(t *testing.T) *gin.Engine {
	t.Helper()
	pool := testsupport.OpenTestPostgres(t)
	service := systemapplication.NewSettingsService(postgres.NewSettingsRepository(pool))
	homeAssets := systemapplication.NewHomeAssetService(flowFakeStore{}, service)
	handler := NewHandler(service, homeAssets)
	router := gin.New()
	router.PUT("/admin/system/mini-app-settings", handler.UpdateMiniAppSettings)
	router.GET("/admin/system/mini-app-settings", handler.GetMiniAppSettings)
	router.GET("/app/system/mini-app-runtime-config", handler.GetMiniAppRuntimeConfig)
	router.POST("/admin/system/mini-app-settings/home/next-match-social-image", handler.UploadHomeNextMatchSocialImage)
	router.POST("/admin/system/mini-app-settings/home/share-images/:scene", handler.UploadHomeShareImage)
	return router
}

func TestMiniAppSettingsPersistAcrossReads(t *testing.T) {
	router := newSettingsRouter(t)

	put := httptest.NewRequest(http.MethodPut, "/admin/system/mini-app-settings", strings.NewReader(`{"debug":{"clear_profile_enabled":true}}`))
	put.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, put)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"clear_profile_enabled":true`) {
		t.Fatalf("update failed: status=%d body=%s", response.Code, response.Body.String())
	}

	get := httptest.NewRequest(http.MethodGet, "/admin/system/mini-app-settings", nil)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, get)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"clear_profile_enabled":true`) {
		t.Fatalf("read-back failed: status=%d body=%s", response.Code, response.Body.String())
	}

	runtime := httptest.NewRequest(http.MethodGet, "/app/system/mini-app-runtime-config", nil)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, runtime)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"clear_profile_enabled":true`) {
		t.Fatalf("runtime config should overlay stored debug flag: status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestMiniAppSettingsDefaultToOffWithoutRow(t *testing.T) {
	router := newSettingsRouter(t)

	runtime := httptest.NewRequest(http.MethodGet, "/app/system/mini-app-runtime-config", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, runtime)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"clear_profile_enabled":false`) {
		t.Fatalf("runtime config should default debug flag to off: status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestUpdateMiniAppSettingsRejectsInvalidBody(t *testing.T) {
	router := newSettingsRouter(t)

	request := httptest.NewRequest(http.MethodPut, "/admin/system/mini-app-settings", strings.NewReader(`{"debug":{}}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if !strings.Contains(response.Body.String(), `"code"`) || strings.Contains(response.Body.String(), `"code":0`) {
		t.Fatalf("expected non-zero business error envelope: status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestMiniAppSettingsToggleBackToOff(t *testing.T) {
	router := newSettingsRouter(t)

	putOn := httptest.NewRequest(http.MethodPut, "/admin/system/mini-app-settings", strings.NewReader(`{"debug":{"clear_profile_enabled":true}}`))
	putOn.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(httptest.NewRecorder(), putOn)

	putOff := httptest.NewRequest(http.MethodPut, "/admin/system/mini-app-settings", strings.NewReader(`{"debug":{"clear_profile_enabled":false}}`))
	putOff.Header.Set("Content-Type", "application/json")
	responseOff := httptest.NewRecorder()
	router.ServeHTTP(responseOff, putOff)

	runtime := httptest.NewRequest(http.MethodGet, "/app/system/mini-app-runtime-config", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, runtime)
	if !strings.Contains(response.Body.String(), `"clear_profile_enabled":false`) {
		t.Fatalf("runtime config should reflect disabled flag: %s", response.Body.String())
	}
}

func TestReviewStatusToggleFlowsToRuntimeConfig(t *testing.T) {
	router := newSettingsRouter(t)

	put := httptest.NewRequest(http.MethodPut, "/admin/system/mini-app-settings", strings.NewReader(`{"debug":{"review_status_toggle_enabled":true}}`))
	put.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, put)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"review_status_toggle_enabled":true`) {
		t.Fatalf("update failed: status=%d body=%s", response.Code, response.Body.String())
	}

	runtime := httptest.NewRequest(http.MethodGet, "/app/system/mini-app-runtime-config", nil)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, runtime)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"review_status_toggle_enabled":true`) {
		t.Fatalf("runtime config should expose review toggle flag: status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestMiniAppSettingsPartialUpdateKeepsOtherFlag(t *testing.T) {
	router := newSettingsRouter(t)

	putToggle := httptest.NewRequest(http.MethodPut, "/admin/system/mini-app-settings", strings.NewReader(`{"debug":{"review_status_toggle_enabled":true}}`))
	putToggle.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(httptest.NewRecorder(), putToggle)

	putProfile := httptest.NewRequest(http.MethodPut, "/admin/system/mini-app-settings", strings.NewReader(`{"debug":{"clear_profile_enabled":true}}`))
	putProfile.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(httptest.NewRecorder(), putProfile)

	runtime := httptest.NewRequest(http.MethodGet, "/app/system/mini-app-runtime-config", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, runtime)
	body := response.Body.String()
	if !strings.Contains(body, `"review_status_toggle_enabled":true`) || !strings.Contains(body, `"clear_profile_enabled":true`) {
		t.Fatalf("updating one debug flag must not reset the other: %s", body)
	}
}

func TestOnboardingFlagFlowsToRuntimeConfig(t *testing.T) {
	router := newSettingsRouter(t)

	put := httptest.NewRequest(http.MethodPut, "/admin/system/mini-app-settings", strings.NewReader(`{"onboarding":{"enabled":true}}`))
	put.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, put)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"enabled":true`) {
		t.Fatalf("update failed: status=%d body=%s", response.Code, response.Body.String())
	}

	runtime := httptest.NewRequest(http.MethodGet, "/app/system/mini-app-runtime-config", nil)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, runtime)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"onboarding":{"enabled":true}`) {
		t.Fatalf("runtime config should expose onboarding flag: status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestOnboardingDefaultsToOffWithoutRow(t *testing.T) {
	router := newSettingsRouter(t)

	runtime := httptest.NewRequest(http.MethodGet, "/app/system/mini-app-runtime-config", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, runtime)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"onboarding":{"enabled":false}`) {
		t.Fatalf("runtime config should default onboarding to off: status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestOnboardingUpdateDoesNotResetDebugFlags(t *testing.T) {
	router := newSettingsRouter(t)

	putDebug := httptest.NewRequest(http.MethodPut, "/admin/system/mini-app-settings", strings.NewReader(`{"debug":{"clear_profile_enabled":true}}`))
	putDebug.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(httptest.NewRecorder(), putDebug)

	putOnboarding := httptest.NewRequest(http.MethodPut, "/admin/system/mini-app-settings", strings.NewReader(`{"onboarding":{"enabled":true}}`))
	putOnboarding.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(httptest.NewRecorder(), putOnboarding)

	// 反向再更新一次 debug，确认 onboarding 开关不会被跨分区重置。
	putDebugAgain := httptest.NewRequest(http.MethodPut, "/admin/system/mini-app-settings", strings.NewReader(`{"debug":{"review_status_toggle_enabled":true}}`))
	putDebugAgain.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(httptest.NewRecorder(), putDebugAgain)

	runtime := httptest.NewRequest(http.MethodGet, "/app/system/mini-app-runtime-config", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, runtime)
	body := response.Body.String()
	if !strings.Contains(body, `"onboarding":{"enabled":true}`) ||
		!strings.Contains(body, `"clear_profile_enabled":true`) ||
		!strings.Contains(body, `"review_status_toggle_enabled":true`) {
		t.Fatalf("cross-section updates must not reset each other: %s", body)
	}
}

func TestHomeSettingsFlowToRuntimeConfig(t *testing.T) {
	router := newSettingsRouter(t)

	put := httptest.NewRequest(http.MethodPut, "/admin/system/mini-app-settings",
		strings.NewReader(`{"home":{"next_match_social_image_url":"https://cdn.example.com/static/home/next-match-social/abc.png"}}`))
	put.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, put)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"next_match_social_image_url":"https://cdn.example.com/static/home/next-match-social/abc.png"`) {
		t.Fatalf("home update failed: status=%d body=%s", response.Code, response.Body.String())
	}

	get := httptest.NewRequest(http.MethodGet, "/admin/system/mini-app-settings", nil)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, get)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"home":{"next_match_social_image_url"`) {
		t.Fatalf("admin settings should include home section: status=%d body=%s", response.Code, response.Body.String())
	}

	runtime := httptest.NewRequest(http.MethodGet, "/app/system/mini-app-runtime-config", nil)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, runtime)
	body := response.Body.String()
	if response.Code != http.StatusOK || !strings.Contains(body, `"next_match_social_image_url":"https://cdn.example.com/static/home/next-match-social/abc.png"`) {
		t.Fatalf("runtime config should expose home image URL: status=%d body=%s", response.Code, body)
	}
	// home 分区更新不能重置其他分区。
	if !strings.Contains(body, `"onboarding":{"enabled":false}`) {
		t.Fatalf("home update must not reset onboarding defaults: %s", body)
	}
}

func TestUploadHomeNextMatchSocialImagePersistsToDatabase(t *testing.T) {
	router := newSettingsRouter(t)

	upload := multipartUploadRequest("/admin/system/mini-app-settings/home/next-match-social-image", "image/png", "social.png", validPNG())
	response := httptest.NewRecorder()
	router.ServeHTTP(response, upload)
	if response.Code != http.StatusOK {
		t.Fatalf("upload failed: status=%d body=%s", response.Code, response.Body.String())
	}

	runtime := httptest.NewRequest(http.MethodGet, "/app/system/mini-app-runtime-config", nil)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, runtime)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(),
		`"next_match_social_image_url":"https://cdn.example.com/static/home/next-match-social/`) {
		t.Fatalf("runtime config should expose uploaded home image URL: status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestOnboardingImagesPersistToRuntimeConfig(t *testing.T) {
	router := newSettingsRouter(t)
	for _, scene := range []string{"welcome", "team", "match"} {
		request := httptest.NewRequest(http.MethodPut, "/admin/system/mini-app-settings", strings.NewReader(fmt.Sprintf(`{"home":{"onboarding_%s_image_url":"https://cdn.example.com/%s.png"}}`, scene, scene)))
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		readHome(t, response)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/app/system/mini-app-runtime-config", nil))
	home := readHome(t, response)
	for _, scene := range []string{"welcome", "team", "match"} {
		if home["onboarding_"+scene+"_image_url"] != "https://cdn.example.com/"+scene+".png" {
			t.Fatalf("persisted URL missing: %+v", home)
		}
	}
	if home["next_match_social_image_url"] != "" {
		t.Fatalf("legacy default changed: %+v", home)
	}
}

func TestShareImagesPersistToRuntimeConfig(t *testing.T) {
	router := newSettingsRouter(t)
	for _, scene := range []string{"home", "hall", "team", "match"} {
		request := httptest.NewRequest(http.MethodPut, "/admin/system/mini-app-settings", strings.NewReader(fmt.Sprintf(`{"home":{"share_%s_image_url":"https://cdn.example.com/%s.png"}}`, scene, scene)))
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		readHome(t, response)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/app/system/mini-app-runtime-config", nil))
	home := readHome(t, response)
	for _, scene := range []string{"home", "hall", "team", "match"} {
		if home["share_"+scene+"_image_url"] != "https://cdn.example.com/"+scene+".png" {
			t.Fatalf("persisted URL missing: %+v", home)
		}
	}
	if home["next_match_social_image_url"] != "" {
		t.Fatalf("legacy default changed: %+v", home)
	}
}

func TestShareUploadsPersistToDatabase(t *testing.T) {
	router := newSettingsRouter(t)
	for _, scene := range []string{"home", "hall", "team", "match"} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, multipartUploadRequest("/admin/system/mini-app-settings/home/share-images/"+scene, "application/octet-stream", "untrusted.bin", validPNG()))
		readHome(t, response)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/app/system/mini-app-runtime-config", nil))
	home := readHome(t, response)
	for _, scene := range []string{"home", "hall", "team", "match"} {
		if !strings.HasPrefix(fmt.Sprint(home["share_"+scene+"_image_url"]), "https://cdn.example.com/static/home/share/"+scene+"/") {
			t.Fatalf("persisted upload missing: %+v", home)
		}
	}
}
