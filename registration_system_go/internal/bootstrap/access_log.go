package bootstrap

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
)

const slowRequestThreshold = time.Second

// accessLogger 在路由执行前确定业务动作，供错误日志复用；执行后按结果记录一次。
func accessLogger(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		route := c.FullPath()
		if route == "" {
			route = "<unmatched>"
		}
		operation, action := requestSemantics(c.Request.Method, route)
		c.Set(sharedhttpapi.AccessLogActiveContextKey, true)
		c.Set(sharedhttpapi.OperationContextKey, operation)
		c.Set(sharedhttpapi.ActionContextKey, action)

		started := time.Now()
		c.Next()
		elapsed := time.Since(started)
		status := c.Writer.Status()
		level := accessLogLevel(c.Request.Method, status, elapsed)
		if !logger.Enabled(c.Request.Context(), level) {
			return
		}

		args := []any{
			"operation", operation, "method", c.Request.Method, "route", route,
			"status", status, "duration_ms", float64(elapsed.Microseconds()) / 1000,
		}
		message := c.Request.Method + " " + route
		if action != "" {
			message = action
			args = append(args, "action", action)
		}
		if elapsed >= slowRequestThreshold {
			args = append(args, "slow", true)
		}
		if value, ok := c.Get(sharedhttpapi.ErrorContextKey); ok {
			if err, ok := value.(error); ok {
				args = append(args, "error", err)
				if cause := errors.Unwrap(err); cause != nil {
					args = append(args, "cause", cause)
				}
			}
		}
		if stage := c.GetString(sharedhttpapi.StageContextKey); stage != "" {
			args = append(args, "stage", stage)
		}
		logger.Log(c.Request.Context(), level, message, args...)
	}
}

func accessLogLevel(method string, status int, elapsed time.Duration) slog.Level {
	switch {
	case status >= http.StatusInternalServerError:
		return slog.LevelError
	case status >= http.StatusBadRequest || elapsed >= slowRequestThreshold:
		return slog.LevelWarn
	case method == http.MethodGet || method == http.MethodHead || method == http.MethodOptions:
		return slog.LevelDebug
	default:
		return slog.LevelInfo
	}
}

func requestSemantics(method, route string) (operation, action string) {
	switch method + " " + route {
	case "GET /api/v1/app/users/me":
		return "user.profile.load", "查询我的资料"
	case "GET /api/v1/app/teams/my":
		return "team.memberships.load", "查询我的球队"
	case "GET /api/v1/app/matches/home":
		return "match.home.load", "查询首页比赛"
	case "GET /api/v1/app/matches/:id":
		return "match.detail.load", "查询比赛详情"
	case "GET /api/v1/app/matches":
		return "match.list", "查询比赛列表"
	case "GET /api/v1/app/notifications/unread-count":
		return "notification.unread_count.load", "查询通知未读数"
	case "GET /api/v1/app/captain-messages/unread-count":
		return "captain_message.unread_count.load", "查询队长留言未读数"
	case "POST /api/v1/app/matches":
		return "match.create", "创建比赛"
	case "PATCH /api/v1/app/matches/:id":
		return "match.update", "修改比赛"
	case "PATCH /api/v1/app/matches/:id/status":
		return "match.status.update", "更新比赛状态"
	case "PATCH /api/v1/app/matches/:id/score":
		return "match.score.update", "录入比赛比分"
	}
	if route == "<unmatched>" {
		return "http.unmatched", "未匹配路由"
	}
	parts := strings.Split(strings.TrimPrefix(route, "/api/v1/"), "/")
	segments := make([]string, 0, len(parts)+2)
	segments = append(segments, "http", strings.ToLower(method))
	for _, part := range parts {
		if part != "" && !strings.HasPrefix(part, ":") {
			segments = append(segments, strings.ReplaceAll(part, "-", "_"))
		}
	}
	return strings.Join(segments, "."), ""
}
