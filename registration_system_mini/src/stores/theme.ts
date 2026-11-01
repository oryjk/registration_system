import { computed, ref } from "vue";
import {
  ACCENT_THEMES,
  DEFAULT_ACCENT_THEME,
  buildAccentThemePageStyle,
  type AccentThemeId,
  type AccentThemePalette,
} from "@/config/themePalettes";
// #ifndef MP-WEIXIN
import { getStoredAccentTheme, setStoredAccentTheme } from "@/utils/themeStorage";
// #endif

// 微信固定薄荷蓝，不恢复旧主题，避免首屏闪出历史配色；H5 保留设备偏好。
const accentTheme = ref<AccentThemeId>(DEFAULT_ACCENT_THEME);
// #ifndef MP-WEIXIN
accentTheme.value = getStoredAccentTheme();
// #endif

const palette = computed<AccentThemePalette>(() => ACCENT_THEMES[accentTheme.value]);

/** 注入每页 page-meta page-style 的变量覆盖串；默认薄荷蓝主题也返回显式值，避免 H5 从其他主题切回时旧覆盖残留。 */
const themePageStyle = computed(() => buildAccentThemePageStyle(accentTheme.value));

/** 原生组件（如 switch 的 color 属性）只接受 hex，不接受 CSS 变量。 */
const accentHex = computed(() => palette.value.accent);

// #ifndef MP-WEIXIN
function changeAccentTheme(theme: AccentThemeId) {
  accentTheme.value = theme;
  setStoredAccentTheme(theme);
}
// #endif

export function useAccentTheme() {
  return {
    accentTheme,
    palette,
    themePageStyle,
    accentHex,
    // #ifndef MP-WEIXIN
    setAccentTheme: changeAccentTheme,
    // #endif
  };
}
