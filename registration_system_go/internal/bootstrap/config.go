package bootstrap

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/oryjk/registration_system/registration_system_go/internal/shared/configenv"
)

type AppEnvironment string

const (
	EnvironmentDevelopment AppEnvironment = "development"
	EnvironmentTest        AppEnvironment = "test"
	EnvironmentProduction  AppEnvironment = "production"
)

type Config struct {
	HTTPAddr            string
	DatabaseURL         string
	JWTSecret           string
	WechatAppID         string
	WechatAppSecret     string
	AppEnvironment      AppEnvironment
	EnableH5TestLogin   bool
	H5TestDefaultUserID int64
}

func LoadConfig() (Config, error) {
	configenv.Load()
	defaultUserID, err := positiveInt64Env("H5_TEST_DEFAULT_USER_ID", 37)
	if err != nil {
		return Config{}, err
	}
	config := Config{
		HTTPAddr:            envOrDefault("HTTP_ADDR", ":18080"),
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		JWTSecret:           os.Getenv("JWT_SECRET"),
		WechatAppID:         os.Getenv("WECHAT_APP_ID"),
		WechatAppSecret:     os.Getenv("WECHAT_APP_SECRET"),
		AppEnvironment:      parseAppEnvironment(os.Getenv("APP_ENV")),
		EnableH5TestLogin:   os.Getenv("ENABLE_H5_TEST_LOGIN") == "true",
		H5TestDefaultUserID: defaultUserID,
	}

	for name, value := range map[string]string{
		"DATABASE_URL":      config.DatabaseURL,
		"JWT_SECRET":        config.JWTSecret,
		"WECHAT_APP_ID":     config.WechatAppID,
		"WECHAT_APP_SECRET": config.WechatAppSecret,
	} {
		if value == "" {
			return Config{}, fmt.Errorf("%s is required", name)
		}
	}
	return config, nil
}

func (c Config) H5TestLoginEnabled() bool {
	return c.EnableH5TestLogin && (c.AppEnvironment == EnvironmentDevelopment || c.AppEnvironment == EnvironmentTest)
}

func parseAppEnvironment(value string) AppEnvironment {
	switch AppEnvironment(strings.TrimSpace(value)) {
	case EnvironmentDevelopment:
		return EnvironmentDevelopment
	case EnvironmentTest:
		return EnvironmentTest
	case EnvironmentProduction:
		return EnvironmentProduction
	default:
		return EnvironmentProduction
	}
}

func positiveInt64Env(name string, fallback int64) (int64, error) {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("%s must be a positive integer", name)
	}
	return parsed, nil
}

func envOrDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
