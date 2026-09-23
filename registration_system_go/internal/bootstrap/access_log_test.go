package bootstrap

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestAccessLogSuppressesRoutineReadAndNamesFailure(t *testing.T) {
	var logs, ginLogs bytes.Buffer
	previousLogger, previousGinWriter := slog.Default(), gin.DefaultWriter
	slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
	gin.DefaultWriter = &ginLogs
	t.Cleanup(func() {
		slog.SetDefault(previousLogger)
		gin.DefaultWriter = previousGinWriter
	})

	router := NewRouter(Dependencies{})
	router.GET("/api/v1/app/matches/home", func(c *gin.Context) {
		if c.Query("fail") == "1" {
			sharedhttpapi.WriteError(c, sharederror.Wrap(sharederror.KindInternal, "查询待处理比赛失败", errors.New("SQLSTATE 42P01: missing relation")))
			return
		}
		c.Status(http.StatusOK)
	})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/app/matches/home?search=private", nil))
	if response.Code != http.StatusOK || logs.Len() != 0 || ginLogs.Len() != 0 {
		t.Fatalf("routine read should be quiet: status=%d slog=%q gin=%q", response.Code, logs.String(), ginLogs.String())
	}

	response = httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/app/matches/home?fail=1&search=private", nil))
	if response.Code != http.StatusInternalServerError || ginLogs.Len() != 0 {
		t.Fatalf("unexpected failure logging: status=%d gin=%q", response.Code, ginLogs.String())
	}
	rawLog := logs.String()
	entry := decodeAccessLog(t, &logs)
	if entry["level"] != "ERROR" || entry["msg"] != "查询首页比赛" || entry["operation"] != "match.home.load" || entry["action"] != "查询首页比赛" || entry["route"] != "/api/v1/app/matches/home" || entry["status"] != float64(http.StatusInternalServerError) || entry["stage"] != "查询待处理比赛失败" || entry["cause"] != "SQLSTATE 42P01: missing relation" {
		t.Fatalf("failure lacks business context: %v", entry)
	}
	var duplicate map[string]any
	if err := json.NewDecoder(&logs).Decode(&duplicate); err != io.EOF {
		t.Fatalf("expected one failure log, got another entry: %v, err=%v", duplicate, err)
	}
	if strings.Contains(rawLog, "private") || strings.Contains(rawLog, "fail=1") {
		t.Fatalf("access log exposed query string: %s", rawLog)
	}
}

func TestAccessLogNamesSuccessfulMutation(t *testing.T) {
	var logs bytes.Buffer
	previousLogger := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
	t.Cleanup(func() { slog.SetDefault(previousLogger) })

	router := NewRouter(Dependencies{})
	router.POST("/api/v1/app/matches", func(c *gin.Context) { c.Status(http.StatusCreated) })
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/v1/app/matches", nil))
	if response.Code != http.StatusCreated {
		t.Fatalf("unexpected status: %d", response.Code)
	}
	entry := decodeAccessLog(t, &logs)
	if entry["level"] != "INFO" || entry["msg"] != "创建比赛" || entry["operation"] != "match.create" || entry["action"] != "创建比赛" || entry["status"] != float64(http.StatusCreated) {
		t.Fatalf("mutation lacks business context: %v", entry)
	}
}

func TestAccessLogUsesAccurateRouteFallbackForUnlabelledAction(t *testing.T) {
	var logs bytes.Buffer
	previousLogger := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
	t.Cleanup(func() { slog.SetDefault(previousLogger) })

	router := NewRouter(Dependencies{})
	router.POST("/api/v1/app/teams/:id/leave", func(c *gin.Context) { c.Status(http.StatusOK) })
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/v1/app/teams/42/leave", nil))
	entry := decodeAccessLog(t, &logs)
	if entry["operation"] != "http.post.app.teams.leave" || entry["msg"] != "POST /api/v1/app/teams/:id/leave" || entry["route"] != "/api/v1/app/teams/:id/leave" {
		t.Fatalf("fallback invented an action or exposed a resource ID: %v", entry)
	}
}

func decodeAccessLog(t *testing.T, logs io.Reader) map[string]any {
	t.Helper()
	var entry map[string]any
	if err := json.NewDecoder(logs).Decode(&entry); err != nil {
		t.Fatalf("decode access log: %v", err)
	}
	return entry
}
