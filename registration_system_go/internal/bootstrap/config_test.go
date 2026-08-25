package bootstrap

import (
	"os"
	"testing"
)

func TestLoadConfigReadsDotEnv(t *testing.T) {
	t.Chdir(t.TempDir())
	unsetConfigEnv(t)
	content := []byte("HTTP_ADDR=:19090\nDATABASE_URL=postgres://localhost/test\nJWT_SECRET=test-jwt-secret-with-at-least-32-bytes\nWECHAT_APP_ID=test-app-id\nWECHAT_APP_SECRET=test-app-secret\nAPP_ENV=development\nWECHAT_PAY_USE_MOCK=true\n")
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
	t.Setenv("APP_ENV", "development")
	t.Setenv("WECHAT_PAY_USE_MOCK", "true")
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

func TestLoadConfigGatesH5TestLoginByExplicitEnvironment(t *testing.T) {
	tests := []struct {
		name        string
		environment string
		enabled     string
		wantEnv     AppEnvironment
		wantEnabled bool
	}{
		{name: "missing environment is production", wantEnv: EnvironmentProduction},
		{name: "unknown environment is production", environment: "staging", enabled: "true", wantEnv: EnvironmentProduction},
		{name: "development needs explicit flag", environment: "development", wantEnv: EnvironmentDevelopment},
		{name: "development enabled", environment: "development", enabled: "true", wantEnv: EnvironmentDevelopment, wantEnabled: true},
		{name: "test enabled", environment: "test", enabled: "true", wantEnv: EnvironmentTest, wantEnabled: true},
		{name: "production stays disabled", environment: "production", enabled: "true", wantEnv: EnvironmentProduction},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Chdir(t.TempDir())
			setRequiredConfigEnv(t)
			t.Setenv("APP_ENV", test.environment)
			t.Setenv("ENABLE_H5_TEST_LOGIN", test.enabled)
			config, err := LoadConfig()
			if err != nil {
				t.Fatalf("LoadConfig() error = %v", err)
			}
			if config.AppEnvironment != test.wantEnv || config.H5TestLoginEnabled() != test.wantEnabled {
				t.Fatalf("environment=%q enabled=%v", config.AppEnvironment, config.H5TestLoginEnabled())
			}
			if config.H5TestDefaultUserID != 4 {
				t.Fatalf("default user ID = %d, want 4", config.H5TestDefaultUserID)
			}
		})
	}
}

func TestLoadConfigRejectsInvalidH5DefaultUserID(t *testing.T) {
	t.Chdir(t.TempDir())
	setRequiredConfigEnv(t)
	t.Setenv("H5_TEST_DEFAULT_USER_ID", "0")
	if _, err := LoadConfig(); err == nil {
		t.Fatal("expected invalid H5 default user ID error")
	}
}

func TestLoadConfigRejectsMockPaymentInProduction(t *testing.T) {
	t.Chdir(t.TempDir())
	setRequiredConfigEnv(t)
	t.Setenv("APP_ENV", "production")
	t.Setenv("WECHAT_PAY_USE_MOCK", "true")
	if _, err := LoadConfig(); err == nil {
		t.Fatal("expected production Mock payment error")
	}
}

func TestLoadConfigRequiresRealWechatPaySettingsWhenMockDisabled(t *testing.T) {
	t.Chdir(t.TempDir())
	setRequiredConfigEnv(t)
	t.Setenv("APP_ENV", "production")
	t.Setenv("WECHAT_PAY_MCH_ID", "")
	t.Setenv("WECHAT_PAY_API_KEY", "")
	t.Setenv("PUBLIC_BASE_URL", "")
	if _, err := LoadConfig(); err == nil {
		t.Fatal("expected missing real WeChat Pay settings error")
	}
}

func setRequiredConfigEnv(t *testing.T) {
	t.Helper()
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("JWT_SECRET", "test-jwt-secret-with-at-least-32-bytes")
	t.Setenv("WECHAT_APP_ID", "test-app-id")
	t.Setenv("WECHAT_APP_SECRET", "test-app-secret")
	t.Setenv("APP_ENV", "development")
	t.Setenv("WECHAT_PAY_USE_MOCK", "false")
	t.Setenv("WECHAT_PAY_MCH_ID", "test-mch-id")
	t.Setenv("WECHAT_PAY_API_KEY", "test-api-key")
	t.Setenv("WECHAT_PAY_API_BASE_URL", "https://api.mch.weixin.qq.com")
	t.Setenv("PUBLIC_BASE_URL", "https://example.com")
	t.Setenv("WECHAT_PAY_NOTIFY_PATH", "/api/v1/webhooks/wechat-pay")
}

func unsetConfigEnv(t *testing.T) {
	t.Helper()
	for _, name := range []string{"HTTP_ADDR", "DATABASE_URL", "JWT_SECRET", "WECHAT_APP_ID", "WECHAT_APP_SECRET", "APP_ENV", "ENABLE_H5_TEST_LOGIN", "H5_TEST_DEFAULT_USER_ID", "WECHAT_PAY_USE_MOCK", "WECHAT_PAY_MCH_ID", "WECHAT_PAY_API_KEY", "WECHAT_PAY_API_BASE_URL", "PUBLIC_BASE_URL", "WECHAT_PAY_NOTIFY_PATH"} {
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
