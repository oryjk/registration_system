package domain

// MiniAppSettings 是小程序运行时配置中可运营调整、按分区落库的部分。
// 目前有 debug 与 onboarding 分区；后续新增分区时同步扩展这里与 mini 端默认值。
type MiniAppSettings struct {
	Debug      DebugSettings      `json:"debug"`
	Onboarding OnboardingSettings `json:"onboarding"`
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

// DefaultMiniAppSettings 返回全部关闭的安全默认值。
func DefaultMiniAppSettings() MiniAppSettings {
	return MiniAppSettings{}
}
