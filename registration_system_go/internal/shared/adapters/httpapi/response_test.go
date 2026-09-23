package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestWriteErrorLogsInternalCauseWithoutExposingItToClient(t *testing.T) {
	var logs bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })

	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/v1/app/matches/home", nil)
	context.Set("request_operation", "match.home.load")
	context.Set("request_action", "查询首页比赛")
	WriteError(context, sharederror.Wrap(sharederror.KindInternal, "查询待处理比赛失败", errors.New("SQLSTATE 42P01: missing relation")))

	if response.Code != http.StatusInternalServerError || strings.Contains(response.Body.String(), "SQLSTATE") {
		t.Fatalf("unexpected client response: status=%d body=%s", response.Code, response.Body.String())
	}
	var entry map[string]any
	if err := json.Unmarshal(logs.Bytes(), &entry); err != nil {
		t.Fatalf("decode log: %v", err)
	}
	if entry["cause"] != "SQLSTATE 42P01: missing relation" {
		t.Fatalf("underlying error missing from log: %s", logs.String())
	}
	if entry["operation"] != "match.home.load" || entry["action"] != "查询首页比赛" || entry["stage"] != "查询待处理比赛失败" {
		t.Fatalf("business context missing from log: %s", logs.String())
	}
}
