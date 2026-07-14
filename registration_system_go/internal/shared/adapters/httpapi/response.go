package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	sharedhttp "github.com/oryjk/registration_system/registration_system_go/internal/shared/http"
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
	c.JSON(status, sharedhttp.Response[any]{Code: status, Message: message, Data: nil})
}
