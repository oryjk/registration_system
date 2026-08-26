package bootstrap

import (
	"fmt"
	"net/url"
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
	WechatPayUseMock    bool
	WechatPayMerchantID string
	WechatPayAPIKey     string
	WechatPayAPIBaseURL string
	PublicBaseURL       string
	WechatPayNotifyPath string
	// UploadDir 是头像等用户上传文件的本地存储根目录，通过 /uploads 静态路径对外服务。
	UploadDir string
	// UploadStorage 选择球队 Logo 等上传的存储后端："minio" 走 MinIO（S3 兼容），其余值走本地目录。
	UploadStorage string
	// UploadMinio* 是 MinIO 连接与公网前缀配置，键名与 Rust 旧后端一致以便环境复用。
	UploadMinioEndpoint        string
	UploadMinioAccessKey       string
	UploadMinioSecretKey       string
	UploadMinioBucket          string
	UploadMinioRegion          string
	UploadMinioPublicURLPrefix string
	// MiniReviewAPIKey 供小程序生产构建脚本登记审核版本；为空时登记接口关闭。
	MiniReviewAPIKey string
	// MiniReviewControlUserIDs 允许在小程序端切换审核状态的用户白名单
	//（env MINI_REVIEW_CONTROL_USER_IDS，逗号分隔）；为空时切换接口对所有人关闭。
	MiniReviewControlUserIDs map[int64]struct{}
}

func LoadConfig() (Config, error) {
	configenv.Load()
	defaultUserID, err := positiveInt64Env("H5_TEST_DEFAULT_USER_ID", 4)
	if err != nil {
		return Config{}, err
	}
	config := Config{
		HTTPAddr:                   envOrDefault("HTTP_ADDR", ":18080"),
		DatabaseURL:                os.Getenv("DATABASE_URL"),
		JWTSecret:                  os.Getenv("JWT_SECRET"),
		WechatAppID:                os.Getenv("WECHAT_APP_ID"),
		WechatAppSecret:            os.Getenv("WECHAT_APP_SECRET"),
		AppEnvironment:             parseAppEnvironment(os.Getenv("APP_ENV")),
		EnableH5TestLogin:          os.Getenv("ENABLE_H5_TEST_LOGIN") == "true",
		H5TestDefaultUserID:        defaultUserID,
		WechatPayUseMock:           os.Getenv("WECHAT_PAY_USE_MOCK") == "true",
		WechatPayMerchantID:        strings.TrimSpace(os.Getenv("WECHAT_PAY_MCH_ID")),
		WechatPayAPIKey:            strings.TrimSpace(os.Getenv("WECHAT_PAY_API_KEY")),
		WechatPayAPIBaseURL:        envOrDefault("WECHAT_PAY_API_BASE_URL", "https://api.mch.weixin.qq.com"),
		PublicBaseURL:              strings.TrimRight(strings.TrimSpace(os.Getenv("PUBLIC_BASE_URL")), "/"),
		WechatPayNotifyPath:        envOrDefault("WECHAT_PAY_NOTIFY_PATH", "/api/v1/webhooks/wechat-pay"),
		UploadDir:                  envOrDefault("UPLOAD_DIR", "uploads"),
		UploadStorage:              os.Getenv("UPLOAD_STORAGE_BACKEND"),
		UploadMinioEndpoint:        os.Getenv("UPLOAD_MINIO_ENDPOINT"),
		UploadMinioAccessKey:       os.Getenv("UPLOAD_MINIO_ACCESS_KEY"),
		UploadMinioSecretKey:       os.Getenv("UPLOAD_MINIO_SECRET_KEY"),
		UploadMinioBucket:          os.Getenv("UPLOAD_MINIO_BUCKET"),
		UploadMinioRegion:          os.Getenv("UPLOAD_MINIO_REGION"),
		UploadMinioPublicURLPrefix: os.Getenv("UPLOAD_MINIO_PUBLIC_URL_PREFIX"),
		MiniReviewAPIKey:           strings.TrimSpace(os.Getenv("MINI_REVIEW_API_KEY")),
		MiniReviewControlUserIDs:   parseUserIDListEnv(os.Getenv("MINI_REVIEW_CONTROL_USER_IDS")),
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
	if err := config.validateWechatPay(); err != nil {
		return Config{}, err
	}
	return config, nil
}

func (c Config) validateWechatPay() error {
	if c.WechatPayUseMock {
		if c.AppEnvironment == EnvironmentProduction {
			return fmt.Errorf("WECHAT_PAY_USE_MOCK cannot be enabled in production")
		}
		return nil
	}
	for name, value := range map[string]string{
		"WECHAT_PAY_MCH_ID":  c.WechatPayMerchantID,
		"WECHAT_PAY_API_KEY": c.WechatPayAPIKey,
		"PUBLIC_BASE_URL":    c.PublicBaseURL,
	} {
		if value == "" {
			return fmt.Errorf("%s is required when WECHAT_PAY_USE_MOCK is false", name)
		}
	}
	base, err := url.Parse(c.WechatPayAPIBaseURL)
	if err != nil || (base.Scheme != "http" && base.Scheme != "https") || base.Host == "" {
		return fmt.Errorf("WECHAT_PAY_API_BASE_URL must be an absolute HTTP URL")
	}
	public, err := url.Parse(c.PublicBaseURL)
	if err != nil || public.Scheme != "https" || public.Host == "" {
		return fmt.Errorf("PUBLIC_BASE_URL must be an absolute HTTPS URL")
	}
	if !strings.HasPrefix(c.WechatPayNotifyPath, "/") {
		return fmt.Errorf("WECHAT_PAY_NOTIFY_PATH must start with /")
	}
	return nil
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

// parseUserIDListEnv 解析逗号分隔的用户 ID 列表（"4,12"）；
// 空串或全部无效时返回 nil，表示白名单未配置。
func parseUserIDListEnv(raw string) map[int64]struct{} {
	ids := make(map[int64]struct{})
	for _, part := range strings.Split(raw, ",") {
		parsed, err := strconv.ParseInt(strings.TrimSpace(part), 10, 64)
		if err != nil || parsed <= 0 {
			continue
		}
		ids[parsed] = struct{}{}
	}
	if len(ids) == 0 {
		return nil
	}
	return ids
}
