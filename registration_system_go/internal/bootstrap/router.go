package bootstrap

import (
	"net/http"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	matchhttp "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/http"
	minireviewhttp "github.com/oryjk/registration_system/registration_system_go/internal/minireview/adapters/http"
	notificationhttp "github.com/oryjk/registration_system/registration_system_go/internal/notification/adapters/http"
	paymenthttp "github.com/oryjk/registration_system/registration_system_go/internal/payment/adapters/http"
	sharedhttp "github.com/oryjk/registration_system/registration_system_go/internal/shared/http"
	systemhttp "github.com/oryjk/registration_system/registration_system_go/internal/system/adapters/http"
	teamhttp "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/http"
	teamfundhttp "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/adapters/http"
	userhttp "github.com/oryjk/registration_system/registration_system_go/internal/user/adapters/http"
	wallethttp "github.com/oryjk/registration_system/registration_system_go/internal/wallet/adapters/http"
)

type Dependencies struct {
	AuthMiddleware     *authhttp.Middleware
	UserAuth           *authhttp.Handler
	WebviewCodes       *authhttp.WebviewCodeHandler
	TestAuth           *authhttp.TestHandler
	AdminAuth          *authhttp.AdminHandler
	UserProfiles       *userhttp.Handler
	AppUsers           *userhttp.AppHandler
	ActiveUsers        authhttp.ActiveUserChecker
	H5TestLoginEnabled bool
	Teams              *teamhttp.Handler
	AppTeams           *teamhttp.AppHandler
	AppTeamManage      *teamhttp.AppManageHandler
	AppTeamSelf        *teamhttp.AppSelfHandler
	UserMatches        *matchhttp.UserHandler
	UserRegistrations  *matchhttp.UserRegistrationHandler
	AdminMatches       *matchhttp.AdminHandler
	TeamApplications   *matchhttp.TeamApplicationHandler
	CaptainMessages    *matchhttp.CaptainMessageHandler
	Payments           *paymenthttp.Handler
	Wallets            *wallethttp.Handler
	MiniReviews        *minireviewhttp.Handler
	SystemRuntime      *systemhttp.Handler
	TeamFunds          *teamfundhttp.Handler
	Notifications      *notificationhttp.Handler
	// UploadDir 非空时以 /uploads 静态路径对外提供上传文件（如头像）。
	UploadDir string
}

func NewRouter(dependencies Dependencies) *gin.Engine {
	// 默认 debug 模式会打印全部路由注册明细；日常启动只需要端口与关键事件，
	// 统一切到 release 口径（请求访问日志由下方 gin.Logger 继续输出）。
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	router.Use(localDevelopmentCORS())
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, sharedhttp.Success(gin.H{"status": "ok"}))
	})
	registerOpenAPI(router)
	if dependencies.UploadDir != "" {
		router.Static("/uploads", dependencies.UploadDir)
	}

	v1 := router.Group("/api/v1")
	app := v1.Group("/app")
	if dependencies.UserAuth != nil {
		dependencies.UserAuth.RegisterPublicRoutes(app)
	}
	if dependencies.WebviewCodes != nil {
		dependencies.WebviewCodes.RegisterPublicRoutes(app)
	}
	if dependencies.H5TestLoginEnabled && dependencies.TestAuth != nil {
		dependencies.TestAuth.RegisterRoutes(app)
	}
	if dependencies.SystemRuntime != nil {
		// 小程序启动即拉取运行配置，无需登录态。
		dependencies.SystemRuntime.RegisterPublicRoutes(app)
	}
	if dependencies.MiniReviews != nil {
		// 小程序审核状态：运行时查询与生产构建登记都无需用户会话（登记走静态 API key）。
		dependencies.MiniReviews.RegisterPublicRoutes(app)
		dependencies.MiniReviews.RegisterAllocateRoutes(app)
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
		if dependencies.WebviewCodes != nil {
			dependencies.WebviewCodes.RegisterUserRoutes(userRoutes)
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
		if dependencies.AppTeamSelf != nil {
			dependencies.AppTeamSelf.RegisterRoutes(userRoutes)
		}
		if dependencies.UserMatches != nil {
			dependencies.UserMatches.RegisterRoutes(userRoutes)
		}
		if dependencies.CaptainMessages != nil {
			dependencies.CaptainMessages.RegisterRoutes(userRoutes)
		}
		if dependencies.MiniReviews != nil {
			// 用户端审核状态切换：白名单校验在 application 层（env MINI_REVIEW_CONTROL_USER_IDS）。
			dependencies.MiniReviews.RegisterUserRoutes(userRoutes)
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
		if dependencies.TeamFunds != nil {
			dependencies.TeamFunds.RegisterAppRoutes(userRoutes)
		}
		if dependencies.Notifications != nil {
			dependencies.Notifications.RegisterAppRoutes(userRoutes)
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
		if dependencies.MiniReviews != nil {
			dependencies.MiniReviews.RegisterAdminRoutes(adminRoutes)
		}
		if dependencies.SystemRuntime != nil {
			dependencies.SystemRuntime.RegisterAdminRoutes(adminRoutes)
		}
		if dependencies.TeamFunds != nil {
			dependencies.TeamFunds.RegisterAdminRoutes(adminRoutes)
		}
	}
	return router
}
