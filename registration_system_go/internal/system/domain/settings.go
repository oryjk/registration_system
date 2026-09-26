package domain

// MiniAppSettings 是小程序运行时配置中可运营调整、按分区落库的部分。
// 目前有 debug、onboarding 与 home 分区；后续新增分区时同步扩展这里与 mini 端默认值。
type MiniAppSettings struct {
	Debug      DebugSettings      `json:"debug"`
	Onboarding OnboardingSettings `json:"onboarding"`
	Home       HomeSettings       `json:"home"`
}

// DebugSettings 只承载验证用途的隐藏开关，默认全部关闭。
type DebugSettings struct {
	ClearProfileEnabled bool `json:"clear_profile_enabled"`
	// ReviewStatusToggleEnabled 开启后白名单用户可在小程序「我的」页切换当前版本审核状态。
	ReviewStatusToggleEnabled bool `json:"review_status_toggle_enabled"`
}

// OnboardingSettings 控制小程序新手引导。默认关闭：提审版本保持关，
// 过审发布后由运营在管理端打开。
type OnboardingSettings struct {
	Enabled bool `json:"enabled"`
}

// SettingsSectionDebug 是 mini_app_settings 表中 debug 分区的存储键。
const SettingsSectionDebug = "debug"

// SettingsSectionOnboarding 是 mini_app_settings 表中 onboarding 分区的存储键。
const SettingsSectionOnboarding = "onboarding"

// SettingsSectionHome 是 mini_app_settings 表中 home 分区的存储键。
const SettingsSectionHome = "home"

// HomeSettings 承载首页运营资源（如空状态插画 URL）。默认为空：
// 未配置时小程序回退到内置的轻量视觉，不影响首页主体。
type HomeSettings struct {
	NextMatchSocialImageURL   string `json:"next_match_social_image_url"`
	OnboardingWelcomeImageURL string `json:"onboarding_welcome_image_url"`
	OnboardingTeamImageURL    string `json:"onboarding_team_image_url"`
	OnboardingMatchImageURL   string `json:"onboarding_match_image_url"`
	ShareHomeImageURL         string `json:"share_home_image_url"`
	ShareHallImageURL         string `json:"share_hall_image_url"`
	ShareTeamImageURL         string `json:"share_team_image_url"`
	ShareMatchImageURL        string `json:"share_match_image_url"`
}

// DefaultMiniAppSettings 返回全部关闭的安全默认值。
func DefaultMiniAppSettings() MiniAppSettings {
	return MiniAppSettings{}
}
