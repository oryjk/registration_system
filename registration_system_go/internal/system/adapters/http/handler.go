package systemhttp

import (
	"github.com/gin-gonic/gin"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
)

// 小程序运行配置（/system/mini-app-runtime-config）。
// 当前返回与小程序端内置默认值（registration_system_mini
// src/config/runtimeConfigDefaults.ts）一致的静态配置；小程序端
// loadMiniAppRuntimeConfig 会按各自的兜底规则清洗字段，这里不做持久化，
// 未来需要运营可调时再引入存储与 admin 写接口。
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
}

type HeroBanner struct {
	Title      string `json:"title"`
	Subtitle   string `json:"subtitle"`
	ButtonText string `json:"button_text"`
	ImageURL   string `json:"image_url"`
	Enabled    bool   `json:"enabled"`
	SortOrder  int    `json:"sort_order"`
}

type Handler struct{}

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) RegisterPublicRoutes(group *gin.RouterGroup) {
	group.GET("/system/mini-app-runtime-config", h.GetMiniAppRuntimeConfig)
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
	sharedhttpapi.WriteSuccess(c, config)
}
