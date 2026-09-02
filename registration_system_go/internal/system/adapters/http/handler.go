package systemhttp

import (
	"context"

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
}

// 小程序运行配置（/system/mini-app-runtime-config）。
// 静态默认值与小程序端内置默认值（registration_system_mini
// src/config/runtimeConfigDefaults.ts）一致；可运营调整的部分
// （当前仅 debug 分区）从 mini_app_settings 表读取叠加。
type MiniAppRuntimeConfigResponse struct {
	Home struct {
		MatchCardLimit              int          `json:"match_card_limit"`
		ChallengeCardLimit          int          `json:"challenge_card_limit"`
		ActivityFetchPageSize       int          `json:"activity_fetch_page_size"`
		HideMatchesAfterHoldingTime bool         `json:"hide_matches_after_holding_time"`
		HeroBanners                 []HeroBanner `json:"hero_banners"`
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
}

type Handler struct {
	settings MiniAppSettingsService
}

func NewHandler(settings MiniAppSettingsService) *Handler { return &Handler{settings: settings} }

func (h *Handler) RegisterPublicRoutes(group *gin.RouterGroup) {
	group.GET("/system/mini-app-runtime-config", h.GetMiniAppRuntimeConfig)
}

func (h *Handler) RegisterAdminRoutes(group *gin.RouterGroup) {
	group.GET("/system/mini-app-settings", h.GetMiniAppSettings)
	group.PUT("/system/mini-app-settings", h.UpdateMiniAppSettings)
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
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "请求体无效，需要 debug/onboarding 分区至少一个布尔开关"))
		return
	}
	debugProvided := request.Debug != nil &&
		(request.Debug.ClearProfileEnabled != nil || request.Debug.ReviewStatusToggleEnabled != nil)
	onboardingProvided := request.Onboarding != nil && request.Onboarding.Enabled != nil
	if !debugProvided && !onboardingProvided {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "请求体无效，需要 debug/onboarding 分区至少一个布尔开关"))
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
	sharedhttpapi.WriteSuccess(c, saved)
}
