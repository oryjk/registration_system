export interface MiniAppDebugSettings {
  clear_profile_enabled: boolean;
  review_status_toggle_enabled: boolean;
}

export interface MiniAppSettings {
  debug: MiniAppDebugSettings;
}

// 后端按字段级合并更新：请求体只需携带要修改的开关。
export interface MiniAppSettingsUpdate {
  debug: Partial<MiniAppDebugSettings>;
}
