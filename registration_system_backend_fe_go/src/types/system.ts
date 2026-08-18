export interface MiniAppDebugSettings {
  clear_profile_enabled: boolean;
}

export interface MiniAppSettings {
  debug: MiniAppDebugSettings;
}

export interface MiniAppSettingsUpdate {
  debug: MiniAppDebugSettings;
}
