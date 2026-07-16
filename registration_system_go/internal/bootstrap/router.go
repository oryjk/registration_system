package bootstrap

import (
	"net/http"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	matchhttp "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/http"
	sharedhttp "github.com/oryjk/registration_system/registration_system_go/internal/shared/http"
	teamhttp "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/http"
	userhttp "github.com/oryjk/registration_system/registration_system_go/internal/user/adapters/http"
)

type Dependencies struct {
	AuthMiddleware *authhttp.Middleware
	UserAuth       *authhttp.Handler
	AdminAuth      *authhttp.AdminHandler
	UserProfiles   *userhttp.Handler
	Teams          *teamhttp.Handler
	AdminMatches   *matchhttp.AdminHandler
}

func NewRouter(dependencies Dependencies) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, sharedhttp.Success(gin.H{"status": "ok"}))
	})

	api := router.Group("/api")
	if dependencies.UserAuth != nil {
		dependencies.UserAuth.RegisterPublicRoutes(api)
	}
	admin := api.Group("/admin")
	if dependencies.AdminAuth != nil {
		dependencies.AdminAuth.RegisterPublicRoutes(admin)
	}
	if dependencies.AuthMiddleware != nil {
		userRoutes := api.Group("")
		userRoutes.Use(dependencies.AuthMiddleware.RequireUser())
		if dependencies.Teams != nil {
			dependencies.Teams.RegisterUserRoutes(userRoutes)
		}

		adminRoutes := admin.Group("")
		adminRoutes.Use(dependencies.AuthMiddleware.RequireAdmin())
		if dependencies.AdminAuth != nil {
			dependencies.AdminAuth.RegisterProtectedRoutes(adminRoutes)
		}
		if dependencies.Teams != nil {
			dependencies.Teams.RegisterAdminRoutes(adminRoutes)
		}
		if dependencies.UserProfiles != nil {
			dependencies.UserProfiles.RegisterAdminRoutes(adminRoutes)
		}
		if dependencies.AdminMatches != nil {
			dependencies.AdminMatches.RegisterRoutes(adminRoutes)
		}
	}
	return router
}
