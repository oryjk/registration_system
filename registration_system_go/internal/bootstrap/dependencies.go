package bootstrap

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/jwt"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/password"
	authpostgres "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/postgres"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/wechat"
	authapplication "github.com/oryjk/registration_system/registration_system_go/internal/auth/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/defaults"
	matchhttp "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/http"
	matchpostgres "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/postgres"
	matchapplication "github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	minireviewhttp "github.com/oryjk/registration_system/registration_system_go/internal/minireview/adapters/http"
	minireviewpostgres "github.com/oryjk/registration_system/registration_system_go/internal/minireview/adapters/postgres"
	minireviewapplication "github.com/oryjk/registration_system/registration_system_go/internal/minireview/application"
	notificationhttp "github.com/oryjk/registration_system/registration_system_go/internal/notification/adapters/http"
	notificationpostgres "github.com/oryjk/registration_system/registration_system_go/internal/notification/adapters/postgres"
	notificationapplication "github.com/oryjk/registration_system/registration_system_go/internal/notification/application"
	paymenthttp "github.com/oryjk/registration_system/registration_system_go/internal/payment/adapters/http"
	paymentmock "github.com/oryjk/registration_system/registration_system_go/internal/payment/adapters/mock"
	paymentorder "github.com/oryjk/registration_system/registration_system_go/internal/payment/adapters/order"
	paymentpostgres "github.com/oryjk/registration_system/registration_system_go/internal/payment/adapters/postgres"
	"github.com/oryjk/registration_system/registration_system_go/internal/payment/adapters/wechatv2"
	paymentapplication "github.com/oryjk/registration_system/registration_system_go/internal/payment/application"
	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
	"github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/clock"
	systemhttp "github.com/oryjk/registration_system/registration_system_go/internal/system/adapters/http"
	systempostgres "github.com/oryjk/registration_system/registration_system_go/internal/system/adapters/postgres"
	systemapplication "github.com/oryjk/registration_system/registration_system_go/internal/system/application"
	teamhttp "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/http"
	teampassword "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/password"
	teampostgres "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/postgres"
	teamapplication "github.com/oryjk/registration_system/registration_system_go/internal/team/application"
	teamfundhttp "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/adapters/http"
	teamfundpostgres "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/adapters/postgres"
	teamfundapplication "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/adapters/avatarstore"
	userhttp "github.com/oryjk/registration_system/registration_system_go/internal/user/adapters/http"
	userpostgres "github.com/oryjk/registration_system/registration_system_go/internal/user/adapters/postgres"
	userapplication "github.com/oryjk/registration_system/registration_system_go/internal/user/application"
	wallethttp "github.com/oryjk/registration_system/registration_system_go/internal/wallet/adapters/http"
	walletpostgres "github.com/oryjk/registration_system/registration_system_go/internal/wallet/adapters/postgres"
	walletapplication "github.com/oryjk/registration_system/registration_system_go/internal/wallet/application"
)

const (
	jwtTTL         = 24 * time.Hour
	wechatEndpoint = "https://api.weixin.qq.com/sns/jscode2session"
)

func BuildDependencies(ctx context.Context, config Config) (Dependencies, func(), error) {
	pool, err := pgxpool.New(ctx, config.DatabaseURL)
	if err != nil {
		return Dependencies{}, nil, fmt.Errorf("open PostgreSQL pool: %w", err)
	}
	closePool := func() { pool.Close() }
	if err := pool.Ping(ctx); err != nil {
		closePool()
		return Dependencies{}, nil, fmt.Errorf("ping PostgreSQL: %w", err)
	}

	tokens, err := jwt.NewService(config.JWTSecret, jwtTTL)
	if err != nil {
		closePool()
		return Dependencies{}, nil, fmt.Errorf("create JWT service: %w", err)
	}
	adminRepository := authpostgres.NewAdminRepository(pool)
	adminService := authapplication.NewAdminService(adminRepository, password.Bcrypt{}, tokens)
	adminAuthHandler := authhttp.NewAdminHandler(adminService)
	authMiddleware := authhttp.NewMiddleware(tokens)

	userRepository := userpostgres.NewRepository(pool)
	profileService := userapplication.NewProfileService(userRepository)
	userProfileHandler := userhttp.NewHandler(profileService)
	appUserService := userapplication.NewAppService(userRepository)
	avatarStore, err := avatarstore.NewLocal(config.UploadDir)
	if err != nil {
		closePool()
		return Dependencies{}, nil, fmt.Errorf("create avatar store: %w", err)
	}
	appUserHandler := userhttp.NewAppHandler(appUserService, avatarStore, config.PublicBaseURL)
	wechatClient := wechat.NewClient(&http.Client{Timeout: 10 * time.Second}, wechatEndpoint, config.WechatAppID, config.WechatAppSecret)
	wechatLogin := authapplication.NewWechatLogin(wechatClient, userRepository, tokens)
	userAuthHandler := authhttp.NewHandler(wechatLogin)
	testLoginService := authapplication.NewTestLoginService(userRepository, tokens)
	testAuthHandler := authhttp.NewTestHandler(testLoginService, config.H5TestDefaultUserID)

	teamRepository := teampostgres.NewRepository(pool)
	teamService := teamapplication.NewQueryService(teamRepository, teampassword.Bcrypt{})
	teamMemberService := teamapplication.NewMemberService(teamRepository)
	teamHandler := teamhttp.NewHandler(teamService, teamMemberService)
	appTeamService := teamapplication.NewAppQueryService(teamRepository)
	appTeamAttendance := teamapplication.NewAppAttendanceService(teamRepository, teamService)
	appTeamHandler := teamhttp.NewAppHandler(appTeamService, appTeamAttendance)
	appTeamManageService := teamapplication.NewAppManageService(teamRepository, teampassword.Bcrypt{})
	appTeamManageHandler := teamhttp.NewAppManageHandler(appTeamManageService)

	matchRepository := matchpostgres.NewRepository(pool)
	matchClock := clock.System{}
	createMatch := matchapplication.NewCreateMatch(matchRepository, teamService, defaults.Service{}, matchClock)
	finishMatch := matchapplication.NewFinishMatch(matchRepository, teamService, matchClock)
	userMatches := matchapplication.NewUserMatchQueryService(matchRepository)
	userMatchHandler := matchhttp.NewUserHandler(userMatches, createMatch, finishMatch)
	adminMatches := matchapplication.NewAdminMatchService(matchRepository, matchClock, adminService)
	adminMatchHandler := matchhttp.NewAdminHandler(adminMatches, createMatch)
	teamApplications := matchapplication.NewTeamApplicationService(matchRepository, teamService, matchClock)
	teamApplicationHandler := matchhttp.NewTeamApplicationHandler(teamApplications)
	userRegistrations := matchapplication.NewUserRegistrationService(matchRepository, matchClock)
	userRegistrationHandler := matchhttp.NewUserRegistrationHandler(userRegistrations)

	paymentRepository := paymentpostgres.NewRepository(pool)
	var paymentGateway paymentports.Gateway
	if config.WechatPayUseMock {
		paymentGateway = paymentmock.NewGateway(config.WechatAppID, matchClock.Now)
	} else {
		paymentGateway, err = wechatv2.NewClient(&http.Client{Timeout: 10 * time.Second}, wechatv2.Config{
			AppID: config.WechatAppID, MerchantID: config.WechatPayMerchantID,
			APIKey: config.WechatPayAPIKey, BaseURL: config.WechatPayAPIBaseURL,
			NotifyURL: config.PublicBaseURL + config.WechatPayNotifyPath,
		})
		if err != nil {
			closePool()
			return Dependencies{}, nil, fmt.Errorf("create WeChat Pay gateway: %w", err)
		}
	}
	registrationFees := matchapplication.NewRegistrationFeeService(matchRepository)
	paymentService := paymentapplication.NewService(paymentRepository, paymentRepository, paymentRepository, paymentGateway, paymentRepository, paymentRepository, teamService, registrationFees, paymentRepository, paymentRepository, paymentorder.Generator{}, matchClock)
	paymentHandler := paymenthttp.NewHandler(paymentService)
	walletRepository := walletpostgres.NewRepository(pool)
	walletService := walletapplication.NewService(walletRepository)
	walletHandler := wallethttp.NewHandler(walletService)
	miniReviewRepository := minireviewpostgres.NewRepository(pool)
	miniReviewService := minireviewapplication.NewService(miniReviewRepository, miniReviewRepository, miniReviewRepository, clock.System{}, config.MiniReviewControlUserIDs)
	miniReviewHandler := minireviewhttp.NewHandler(miniReviewService, config.MiniReviewAPIKey)
	systemSettingsRepository := systempostgres.NewSettingsRepository(pool)
	systemSettingsService := systemapplication.NewSettingsService(systemSettingsRepository)

	notificationRepository := notificationpostgres.NewRepository(pool)
	notificationService := notificationapplication.NewService(notificationRepository)
	notificationHandler := notificationhttp.NewHandler(notificationService)
	appTeamSelfService := teamapplication.NewAppTeamSelfService(teamRepository, teampassword.Bcrypt{}, notificationService)
	appTeamSelfHandler := teamhttp.NewAppSelfHandler(appTeamSelfService)
	captainMessages := matchapplication.NewCaptainMessageService(matchRepository, matchRepository, teamService)
	captainMessageHandler := matchhttp.NewCaptainMessageHandler(captainMessages)
	teamFundRepository := teamfundpostgres.NewRepository(pool)
	teamFundSettlement := teamfundapplication.NewSettlementService(teamFundRepository,
		matchapplication.NewSettlementRosterService(matchRepository), teamService, notificationService)
	teamFundQueries := teamfundapplication.NewQueryService(teamFundRepository)
	teamFundAdminCredit := teamfundapplication.NewAdminCreditService(teamFundRepository, notificationService)
	teamFundHandler := teamfundhttp.NewHandler(teamFundSettlement, teamFundQueries, teamFundAdminCredit)

	return Dependencies{
		AuthMiddleware: &authMiddleware,
		UserAuth:       userAuthHandler, AdminAuth: adminAuthHandler,
		TestAuth: testAuthHandler, H5TestLoginEnabled: config.H5TestLoginEnabled(),
		UserProfiles: userProfileHandler, AppUsers: appUserHandler, ActiveUsers: appUserService, Teams: teamHandler, AppTeams: appTeamHandler,
		AppTeamManage: appTeamManageHandler, AppTeamSelf: appTeamSelfHandler,
		UserMatches: userMatchHandler, UserRegistrations: userRegistrationHandler,
		AdminMatches: adminMatchHandler, TeamApplications: teamApplicationHandler,
		CaptainMessages: captainMessageHandler,
		Payments:        paymentHandler, Wallets: walletHandler, MiniReviews: miniReviewHandler,
		SystemRuntime: systemhttp.NewHandler(systemSettingsService),
		TeamFunds:     teamFundHandler, Notifications: notificationHandler,
		UploadDir: config.UploadDir,
	}, closePool, nil
}
