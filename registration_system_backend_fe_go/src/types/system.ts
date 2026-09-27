export interface MiniAppDebugSettings {
  clear_profile_enabled: boolean;
  review_status_toggle_enabled: boolean;
}

export interface MiniAppOnboardingSettings {
  enabled: boolean;
}

export type OnboardingImageScene = "welcome" | "team" | "match";

export type ShareImageScene = "home" | "hall" | "team" | "match";

export interface MiniAppHomeSettings {
  share_home_image_url?: string;
  share_hall_image_url?: string;
  share_team_image_url?: string;
  share_match_image_url?: string;
  onboarding_welcome_image_url?: string;
  onboarding_team_image_url?: string;
  onboarding_match_image_url?: string;
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
