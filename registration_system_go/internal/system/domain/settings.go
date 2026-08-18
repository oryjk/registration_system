package domain

// MiniAppSettings 是小程序运行时配置中可运营调整、按分区落库的部分。
// 目前只有 debug 分区；后续新增分区时同步扩展这里与 mini 端默认值。
type MiniAppSettings struct {
	Debug DebugSettings `json:"debug"`
}

// DebugSettings 只承载验证用途的隐藏开关，默认全部关闭。
type DebugSettings struct {
	ClearProfileEnabled bool `json:"clear_profile_enabled"`
}

// SettingsSectionDebug 是 mini_app_settings 表中 debug 分区的存储键。
const SettingsSectionDebug = "debug"

// DefaultMiniAppSettings 返回全部关闭的安全默认值。
func DefaultMiniAppSettings() MiniAppSettings {
	return MiniAppSettings{}
}
