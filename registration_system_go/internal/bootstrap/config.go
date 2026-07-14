package bootstrap

import (
	"fmt"
	"os"
)

type Config struct {
	HTTPAddr        string
	DatabaseURL     string
	JWTSecret       string
	WechatAppID     string
	WechatAppSecret string
}

func LoadConfig() (Config, error) {
	config := Config{
		HTTPAddr:        envOrDefault("HTTP_ADDR", ":18080"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		JWTSecret:       os.Getenv("JWT_SECRET"),
		WechatAppID:     os.Getenv("WECHAT_APP_ID"),
		WechatAppSecret: os.Getenv("WECHAT_APP_SECRET"),
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

func envOrDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
