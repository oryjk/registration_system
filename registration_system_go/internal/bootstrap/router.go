package bootstrap

import (
	"net/http"

	"github.com/gin-gonic/gin"
	sharedhttp "github.com/oryjk/registration_system/registration_system_go/internal/shared/http"
)

type Dependencies struct{}

func NewRouter(_ Dependencies) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, sharedhttp.Success(gin.H{"status": "ok"}))
	})
	return router
}
