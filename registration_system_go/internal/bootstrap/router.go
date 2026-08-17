package bootstrap

import (
	"net/http"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	matchhttp "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/http"
	paymenthttp "github.com/oryjk/registration_system/registration_system_go/internal/payment/adapters/http"
	sharedhttp "github.com/oryjk/registration_system/registration_system_go/internal/shared/http"
	teamhttp "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/http"
	userhttp "github.com/oryjk/registration_system/registration_system_go/internal/user/adapters/http"
	wallethttp "github.com/oryjk/registration_system/registration_system_go/internal/wallet/adapters/http"
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
	AppTeamManage      *teamhttp.AppManageHandler
	UserMatches        *matchhttp.UserHandler
	UserRegistrations  *matchhttp.UserRegistrationHandler
	AdminMatches       *matchhttp.AdminHandler
	TeamApplications   *matchhttp.TeamApplicationHandler
	Payments           *paymenthttp.Handler
	Wallets            *wallethttp.Handler
}

func NewRouter(dependencies Dependencies) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	router.Use(localDevelopmentCORS())
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, sharedhttp.Success(gin.H{"status": "ok"}))
	})
	registerOpenAPI(router)

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
	if dependencies.Payments != nil {
		dependencies.Payments.RegisterWebhookRoutes(v1.Group("/webhooks"))
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
		if dependencies.AppTeamManage != nil {
			dependencies.AppTeamManage.RegisterRoutes(userRoutes)
		}
		if dependencies.UserMatches != nil {
			dependencies.UserMatches.RegisterRoutes(userRoutes)
		}
		if dependencies.UserRegistrations != nil {
			dependencies.UserRegistrations.RegisterRoutes(userRoutes)
		}
		if dependencies.TeamApplications != nil {
			dependencies.TeamApplications.RegisterUserRoutes(userRoutes)
		}
		if dependencies.Payments != nil {
			dependencies.Payments.RegisterAppRoutes(userRoutes)
		}
		if dependencies.Wallets != nil {
			dependencies.Wallets.RegisterAppRoutes(userRoutes)
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
		if dependencies.Payments != nil {
			dependencies.Payments.RegisterAdminRoutes(adminRoutes)
		}
		if dependencies.Wallets != nil {
			dependencies.Wallets.RegisterAdminRoutes(adminRoutes)
		}
	}
	return router
}
