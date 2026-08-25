import { DEFAULT_ACCENT_THEME, isAccentThemeId, type AccentThemeId } from "@/config/themePalettes";

const THEME_ACCENT_KEY = "registration_system_mini_theme_accent";

export function getStoredAccentTheme(): AccentThemeId {
  const value = uni.getStorageSync(THEME_ACCENT_KEY);
  return isAccentThemeId(value) ? value : DEFAULT_ACCENT_THEME;
}

export function setStoredAccentTheme(theme: AccentThemeId): void {
  uni.setStorageSync(THEME_ACCENT_KEY, theme);
}
