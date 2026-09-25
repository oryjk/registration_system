export interface MiniAppDebugSettings {
  clear_profile_enabled: boolean;
  review_status_toggle_enabled: boolean;
}

export interface MiniAppOnboardingSettings {
  enabled: boolean;
}

export interface MiniAppHomeSettings {
  next_match_social_image_url: string;
}

export interface MiniAppSettings {
  debug: MiniAppDebugSettings;
  onboarding: MiniAppOnboardingSettings;
  home: MiniAppHomeSettings;
}

// 后端按分区字段级合并更新：请求体只需携带要修改的分区。
export interface MiniAppSettingsUpdate {
  debug?: Partial<MiniAppDebugSettings>;
  onboarding?: Partial<MiniAppOnboardingSettings>;
  home?: Partial<MiniAppHomeSettings>;
}
