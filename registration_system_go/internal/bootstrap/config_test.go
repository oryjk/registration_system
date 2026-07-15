package bootstrap

import (
	"os"
	"testing"
)

func TestLoadConfigReadsDotEnv(t *testing.T) {
	t.Chdir(t.TempDir())
	unsetConfigEnv(t)
	content := []byte("HTTP_ADDR=:19090\nDATABASE_URL=postgres://localhost/test\nJWT_SECRET=test-jwt-secret-with-at-least-32-bytes\nWECHAT_APP_ID=test-app-id\nWECHAT_APP_SECRET=test-app-secret\n")
	if err := os.WriteFile(".env", content, 0o600); err != nil {
		t.Fatalf("write .env: %v", err)
	}

	config, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() error = %v", err)
	}
	if config.HTTPAddr != ":19090" || config.DatabaseURL != "postgres://localhost/test" {
		t.Fatalf("LoadConfig() = %+v", config)
	}
	if config.JWTSecret != "test-jwt-secret-with-at-least-32-bytes" || config.WechatAppID != "test-app-id" || config.WechatAppSecret != "test-app-secret" {
		t.Fatalf("LoadConfig() did not load required values: %+v", config)
	}
}

func TestLoadConfigPreservesExportedEnvironment(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("HTTP_ADDR", ":18081")
	t.Setenv("DATABASE_URL", "postgres://environment/test")
	t.Setenv("JWT_SECRET", "environment-jwt-secret-with-at-least-32-bytes")
	t.Setenv("WECHAT_APP_ID", "environment-app-id")
	t.Setenv("WECHAT_APP_SECRET", "environment-app-secret")
	content := []byte("HTTP_ADDR=:19090\nDATABASE_URL=postgres://dotenv/test\nJWT_SECRET=dotenv-jwt-secret-with-at-least-32-bytes\nWECHAT_APP_ID=dotenv-app-id\nWECHAT_APP_SECRET=dotenv-app-secret\n")
	if err := os.WriteFile(".env", content, 0o600); err != nil {
		t.Fatalf("write .env: %v", err)
	}

	config, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() error = %v", err)
	}
	if config.HTTPAddr != ":18081" || config.DatabaseURL != "postgres://environment/test" {
		t.Fatalf("LoadConfig() overwrote exported environment: %+v", config)
	}
	if config.JWTSecret != "environment-jwt-secret-with-at-least-32-bytes" || config.WechatAppID != "environment-app-id" || config.WechatAppSecret != "environment-app-secret" {
		t.Fatalf("LoadConfig() overwrote required values: %+v", config)
	}
}

func unsetConfigEnv(t *testing.T) {
	t.Helper()
	for _, name := range []string{"HTTP_ADDR", "DATABASE_URL", "JWT_SECRET", "WECHAT_APP_ID", "WECHAT_APP_SECRET"} {
		value, exists := os.LookupEnv(name)
		if err := os.Unsetenv(name); err != nil {
			t.Fatalf("unset %s: %v", name, err)
		}
		t.Cleanup(func() {
			if exists {
				_ = os.Setenv(name, value)
			} else {
				_ = os.Unsetenv(name)
			}
		})
	}
}
