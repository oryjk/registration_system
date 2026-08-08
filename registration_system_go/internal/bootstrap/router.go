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
	AuthMiddleware     *authhttp.Middleware
	UserAuth           *authhttp.Handler
	TestAuth           *authhttp.TestHandler
	AdminAuth          *authhttp.AdminHandler
	UserProfiles       *userhttp.Handler
	AppUsers           *userhttp.AppHandler
	ActiveUsers        authhttp.ActiveUserChecker
	H5TestLoginEnabled bool
	Teams              *teamhttp.Handler
	AppTeams           *teamhttp.AppHandler
	UserMatches        *matchhttp.UserHandler
	AdminMatches       *matchhttp.AdminHandler
	TeamApplications   *matchhttp.TeamApplicationHandler
}

func NewRouter(dependencies Dependencies) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, sharedhttp.Success(gin.H{"status": "ok"}))
	})

	v1 := router.Group("/api/v1")
	app := v1.Group("/app")
	if dependencies.UserAuth != nil {
		dependencies.UserAuth.RegisterPublicRoutes(app)
	}
	if dependencies.H5TestLoginEnabled && dependencies.TestAuth != nil {
		dependencies.TestAuth.RegisterRoutes(app)
	}
	admin := v1.Group("/admin")
	if dependencies.AdminAuth != nil {
		dependencies.AdminAuth.RegisterPublicRoutes(admin)
	}
	if dependencies.AuthMiddleware != nil {
		userRoutes := app.Group("")
		userRoutes.Use(dependencies.AuthMiddleware.RequireUser())
		if dependencies.ActiveUsers != nil {
			userRoutes.Use(dependencies.AuthMiddleware.RequireActiveUser(dependencies.ActiveUsers))
		}
		if dependencies.AppUsers != nil {
			dependencies.AppUsers.RegisterAppRoutes(userRoutes)
		}
		if dependencies.Teams != nil {
			dependencies.Teams.RegisterUserRoutes(userRoutes)
		}
		if dependencies.AppTeams != nil {
			dependencies.AppTeams.RegisterRoutes(userRoutes)
		}
		if dependencies.UserMatches != nil {
			dependencies.UserMatches.RegisterRoutes(userRoutes)
		}
		if dependencies.TeamApplications != nil {
			dependencies.TeamApplications.RegisterUserRoutes(userRoutes)
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
		if dependencies.TeamApplications != nil {
			dependencies.TeamApplications.RegisterAdminRoutes(adminRoutes)
		}
	}
	return router
}
