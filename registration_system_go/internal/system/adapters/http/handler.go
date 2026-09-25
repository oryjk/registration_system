package systemhttp

import (
	"context"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/domain"
)

// MiniAppSettingsService 是 handler 依赖的配置用例（由 application.SettingsService 实现）。
type MiniAppSettingsService interface {
	Get(ctx context.Context) (domain.MiniAppSettings, error)
	UpdateDebug(ctx context.Context, patch application.DebugSettingsPatch) (domain.MiniAppSettings, error)
	UpdateOnboarding(ctx context.Context, patch application.OnboardingSettingsPatch) (domain.MiniAppSettings, error)
	UpdateHome(ctx context.Context, patch application.HomeSettingsPatch) (domain.MiniAppSettings, error)
}

// HomeAssetUploadService 是 handler 依赖的首页运营图片上传用例
// （由 application.HomeAssetService 实现；存储适配器在 application 层之后注入）。
type HomeAssetUploadService interface {
	UploadNextMatchSocialImage(ctx context.Context, contentType, fileName string, data []byte) (domain.MiniAppSettings, error)
}

// 小程序运行配置（/system/mini-app-runtime-config）。
// 静态默认值与小程序端内置默认值（registration_system_mini
// src/config/runtimeConfigDefaults.ts）一致；可运营调整的部分
// （debug / onboarding / home 分区）从 mini_app_settings 表读取叠加。
type MiniAppRuntimeConfigResponse struct {
	Home struct {
		MatchCardLimit              int          `json:"match_card_limit"`
		ChallengeCardLimit          int          `json:"challenge_card_limit"`
		ActivityFetchPageSize       int          `json:"activity_fetch_page_size"`
		HideMatchesAfterHoldingTime bool         `json:"hide_matches_after_holding_time"`
		HeroBanners                 []HeroBanner `json:"hero_banners"`
		NextMatchSocialImageURL     string       `json:"next_match_social_image_url"`
	} `json:"home"`
	Matches struct {
		RelatedActivityLimit   int `json:"related_activity_limit"`
		ParticipantAvatarLimit int `json:"participant_avatar_limit"`
		CapacityExtraSlots     int `json:"capacity_extra_slots"`
	} `json:"matches"`
	Checkin struct {
		DefaultRadiusMeters      int `json:"default_radius_meters"`
		DefaultOpenMinutesBefore int `json:"default_open_minutes_before"`
		DefaultCloseMinutesAfter int `json:"default_close_minutes_after"`
	} `json:"checkin"`
	Billing struct {
		RecentOrderLimit int `json:"recent_order_limit"`
	} `json:"billing"`
	Notifications struct {
		ListLimit int `json:"list_limit"`
	} `json:"notifications"`
	Profile struct {
		RequirePhoneBinding bool `json:"require_phone_binding"`
	} `json:"profile"`
	Debug struct {
		ClearProfileEnabled       bool `json:"clear_profile_enabled"`
		ReviewStatusToggleEnabled bool `json:"review_status_toggle_enabled"`
	} `json:"debug"`
	Onboarding struct {
		Enabled bool `json:"enabled"`
	} `json:"onboarding"`
}

type HeroBanner struct {
	Title      string `json:"title"`
	Subtitle   string `json:"subtitle"`
	ButtonText string `json:"button_text"`
	ImageURL   string `json:"image_url"`
	Enabled    bool   `json:"enabled"`
	SortOrder  int    `json:"sort_order"`
}

type UpdateMiniAppSettingsRequest struct {
	Debug *struct {
		ClearProfileEnabled       *bool `json:"clear_profile_enabled"`
		ReviewStatusToggleEnabled *bool `json:"review_status_toggle_enabled"`
	} `json:"debug"`
	Onboarding *struct {
		Enabled *bool `json:"enabled"`
	} `json:"onboarding"`
	Home *struct {
		NextMatchSocialImageURL *string `json:"next_match_social_image_url"`
	} `json:"home"`
}

type Handler struct {
	settings   MiniAppSettingsService
	homeAssets HomeAssetUploadService
}

func NewHandler(settings MiniAppSettingsService, homeAssets HomeAssetUploadService) *Handler {
	return &Handler{settings: settings, homeAssets: homeAssets}
}

func (h *Handler) RegisterPublicRoutes(group *gin.RouterGroup) {
	group.GET("/system/mini-app-runtime-config", h.GetMiniAppRuntimeConfig)
}

func (h *Handler) RegisterAdminRoutes(group *gin.RouterGroup) {
	group.GET("/system/mini-app-settings", h.GetMiniAppSettings)
	group.PUT("/system/mini-app-settings", h.UpdateMiniAppSettings)
	group.POST("/system/mini-app-settings/home/next-match-social-image", h.UploadHomeNextMatchSocialImage)
}

func (h *Handler) GetMiniAppRuntimeConfig(c *gin.Context) {
	var config MiniAppRuntimeConfigResponse
	config.Home.MatchCardLimit = 2
	config.Home.ChallengeCardLimit = 2
	config.Home.ActivityFetchPageSize = 100
	config.Home.HideMatchesAfterHoldingTime = true
	config.Home.HeroBanners = []HeroBanner{{
		Title: "约球开踢", Subtitle: "组队 · 报名 · 上场",
		ButtonText: "去看看", ImageURL: "", Enabled: true, SortOrder: 1,
	}}
	config.Matches.RelatedActivityLimit = 2
	config.Matches.ParticipantAvatarLimit = 5
	config.Matches.CapacityExtraSlots = 2
	config.Checkin.DefaultRadiusMeters = 200
	config.Checkin.DefaultOpenMinutesBefore = 60
	config.Checkin.DefaultCloseMinutesAfter = 45
	config.Billing.RecentOrderLimit = 10
	config.Notifications.ListLimit = 50
	config.Profile.RequirePhoneBinding = false

	settings, err := h.settings.Get(c.Request.Context())
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	config.Debug.ClearProfileEnabled = settings.Debug.ClearProfileEnabled
	config.Debug.ReviewStatusToggleEnabled = settings.Debug.ReviewStatusToggleEnabled
	config.Onboarding.Enabled = settings.Onboarding.Enabled
	config.Home.NextMatchSocialImageURL = settings.Home.NextMatchSocialImageURL
	sharedhttpapi.WriteSuccess(c, config)
}

func (h *Handler) GetMiniAppSettings(c *gin.Context) {
	settings, err := h.settings.Get(c.Request.Context())
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, settings)
}

func (h *Handler) UpdateMiniAppSettings(c *gin.Context) {
	var request UpdateMiniAppSettingsRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "请求体无效，需要 debug/onboarding/home 分区至少一个可更新字段"))
		return
	}
	debugProvided := request.Debug != nil &&
		(request.Debug.ClearProfileEnabled != nil || request.Debug.ReviewStatusToggleEnabled != nil)
	onboardingProvided := request.Onboarding != nil && request.Onboarding.Enabled != nil
	homeProvided := request.Home != nil && request.Home.NextMatchSocialImageURL != nil
	if !debugProvided && !onboardingProvided && !homeProvided {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "请求体无效，需要 debug/onboarding/home 分区至少一个可更新字段"))
		return
	}

	var saved domain.MiniAppSettings
	if debugProvided {
		result, err := h.settings.UpdateDebug(c.Request.Context(), application.DebugSettingsPatch{
			ClearProfileEnabled:       request.Debug.ClearProfileEnabled,
			ReviewStatusToggleEnabled: request.Debug.ReviewStatusToggleEnabled,
		})
		if err != nil {
			sharedhttpapi.WriteError(c, err)
			return
		}
		saved = result
	}
	if onboardingProvided {
		result, err := h.settings.UpdateOnboarding(c.Request.Context(), application.OnboardingSettingsPatch{
			Enabled: request.Onboarding.Enabled,
		})
		if err != nil {
			sharedhttpapi.WriteError(c, err)
			return
		}
		saved = result
	}
	if homeProvided {
		result, err := h.settings.UpdateHome(c.Request.Context(), application.HomeSettingsPatch{
			NextMatchSocialImageURL: request.Home.NextMatchSocialImageURL,
		})
		if err != nil {
			sharedhttpapi.WriteError(c, err)
			return
		}
		saved = result
	}
	sharedhttpapi.WriteSuccess(c, saved)
}

// UploadHomeNextMatchSocialImage 接收 multipart 字段 file，上传插画并把 URL 写入 home 分区。
// 校验与存储在 application.HomeAssetService；这里只做协议适配。
func (h *Handler) UploadHomeNextMatchSocialImage(c *gin.Context) {
	if h.homeAssets == nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindInternal, "图片上传未配置"))
		return
	}
	// 请求体上限 = 文件上限 + 1MB multipart 开销余量，防止超大表单耗尽内存。
	maxBodyBytes := int64(application.MaxHomeAssetUploadBytes) + 1<<20
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBodyBytes)

	fileHeader, err := c.FormFile("file")
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "请选择要上传的插画文件"))
		return
	}
	file, err := fileHeader.Open()
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.Wrap(sharederror.KindInternal, "读取插画文件失败", err))
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, application.MaxHomeAssetUploadBytes+1))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.Wrap(sharederror.KindInternal, "读取插画文件失败", err))
		return
	}

	settings, err := h.homeAssets.UploadNextMatchSocialImage(c.Request.Context(),
		fileHeader.Header.Get("Content-Type"), fileHeader.Filename, data)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, settings)
}
