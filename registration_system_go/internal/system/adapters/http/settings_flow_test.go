package systemhttp

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/adapters/postgres"
	systemapplication "github.com/oryjk/registration_system/registration_system_go/internal/system/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func newSettingsRouter(t *testing.T) *gin.Engine {
	t.Helper()
	pool := testsupport.OpenTestPostgres(t)
	service := systemapplication.NewSettingsService(postgres.NewSettingsRepository(pool))
	handler := NewHandler(service)
	router := gin.New()
	router.PUT("/admin/system/mini-app-settings", handler.UpdateMiniAppSettings)
	router.GET("/admin/system/mini-app-settings", handler.GetMiniAppSettings)
	router.GET("/app/system/mini-app-runtime-config", handler.GetMiniAppRuntimeConfig)
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
