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
	"github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/clock"
	teamhttp "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/http"
	teampostgres "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/postgres"
	teamapplication "github.com/oryjk/registration_system/registration_system_go/internal/team/application"
	userhttp "github.com/oryjk/registration_system/registration_system_go/internal/user/adapters/http"
	userpostgres "github.com/oryjk/registration_system/registration_system_go/internal/user/adapters/postgres"
	userapplication "github.com/oryjk/registration_system/registration_system_go/internal/user/application"
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
	appUserHandler := userhttp.NewAppHandler(appUserService)
	wechatClient := wechat.NewClient(&http.Client{Timeout: 10 * time.Second}, wechatEndpoint, config.WechatAppID, config.WechatAppSecret)
	wechatLogin := authapplication.NewWechatLogin(wechatClient, userRepository, tokens)
	userAuthHandler := authhttp.NewHandler(wechatLogin)
	testLoginService := authapplication.NewTestLoginService(userRepository, tokens)
	testAuthHandler := authhttp.NewTestHandler(testLoginService, config.H5TestDefaultUserID)

	teamRepository := teampostgres.NewRepository(pool)
	teamService := teamapplication.NewQueryService(teamRepository)
	teamMemberService := teamapplication.NewMemberService(teamRepository)
	teamHandler := teamhttp.NewHandler(teamService, teamMemberService)
	appTeamService := teamapplication.NewAppQueryService(teamRepository)
	appTeamHandler := teamhttp.NewAppHandler(appTeamService)

	matchRepository := matchpostgres.NewRepository(pool)
	matchClock := clock.System{}
	createMatch := matchapplication.NewCreateMatch(matchRepository, teamService, defaults.Service{}, matchClock)
	userMatches := matchapplication.NewUserMatchQueryService(matchRepository)
	userMatchHandler := matchhttp.NewUserHandler(userMatches)
	adminMatches := matchapplication.NewAdminMatchService(matchRepository, matchClock, adminService)
	adminMatchHandler := matchhttp.NewAdminHandler(adminMatches, createMatch)
	teamApplications := matchapplication.NewTeamApplicationService(matchRepository, teamService, matchClock)
	teamApplicationHandler := matchhttp.NewTeamApplicationHandler(teamApplications)
	userRegistrations := matchapplication.NewUserRegistrationService(matchRepository, teamService, matchClock)
	userRegistrationHandler := matchhttp.NewUserRegistrationHandler(userRegistrations)

	return Dependencies{
		AuthMiddleware: &authMiddleware,
		UserAuth:       userAuthHandler, AdminAuth: adminAuthHandler,
		TestAuth: testAuthHandler, H5TestLoginEnabled: config.H5TestLoginEnabled(),
		UserProfiles: userProfileHandler, AppUsers: appUserHandler, ActiveUsers: appUserService, Teams: teamHandler, AppTeams: appTeamHandler,
		UserMatches: userMatchHandler, UserRegistrations: userRegistrationHandler,
		AdminMatches: adminMatchHandler, TeamApplications: teamApplicationHandler,
	}, closePool, nil
}
