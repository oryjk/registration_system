package httpapi

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	sharedhttp "github.com/oryjk/registration_system/registration_system_go/internal/shared/http"
)

const (
	AccessLogActiveContextKey = "request_access_log_active"
	OperationContextKey       = "request_operation"
	ActionContextKey          = "request_action"
	ErrorContextKey           = "request_error"
	StageContextKey           = "request_error_stage"
)

func WriteSuccess[T any](c *gin.Context, data T) {
	c.JSON(http.StatusOK, sharedhttp.Success(data))
}

func WriteError(c *gin.Context, err error) {
	status := http.StatusInternalServerError
	message := "internal error"
	var businessError *sharederror.Error
	if errors.As(err, &businessError) {
		message = businessError.Message
		switch businessError.Kind {
		case sharederror.KindUnauthorized:
			status = http.StatusUnauthorized
		case sharederror.KindForbidden:
			status = http.StatusForbidden
		case sharederror.KindNotFound:
			status = http.StatusNotFound
		case sharederror.KindConflict:
			status = http.StatusConflict
		case sharederror.KindValidation:
			status = http.StatusUnprocessableEntity
		case sharederror.KindInternal:
			message = "internal error"
		}
	}
	c.Set(ErrorContextKey, err)
	if businessError != nil {
		c.Set(StageContextKey, businessError.Message)
	}
	// 内部错误对客户端只回通用文案，但必须落日志，否则线上 500 无法定位。
	if status == http.StatusInternalServerError && !c.GetBool(AccessLogActiveContextKey) {
		logArgs := []any{"error", err, "method", c.Request.Method, "route", c.FullPath()}
		if operation := c.GetString(OperationContextKey); operation != "" {
			logArgs = append(logArgs, "operation", operation)
		}
		if action := c.GetString(ActionContextKey); action != "" {
			logArgs = append(logArgs, "action", action)
		}
		if stage := c.GetString(StageContextKey); stage != "" {
			logArgs = append(logArgs, "stage", stage)
		}
		if cause := errors.Unwrap(err); cause != nil {
			logArgs = append(logArgs, "cause", cause)
		}
		slog.Error("internal error while handling request", logArgs...)
	}
	c.JSON(status, sharedhttp.Response[any]{Code: status, Message: message, Data: nil})
}
