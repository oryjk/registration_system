import { computed, ref } from "vue";
import {
  ACCENT_THEMES,
  buildAccentThemePageStyle,
  type AccentThemeId,
  type AccentThemePalette,
} from "@/config/themePalettes";
import { getStoredAccentTheme, setStoredAccentTheme } from "@/utils/themeStorage";

// 模块加载时同步读取本地主题，保证首屏（首个 page-meta 渲染前）就是正确主题。
const accentTheme = ref<AccentThemeId>(getStoredAccentTheme());

const palette = computed<AccentThemePalette>(() => ACCENT_THEMES[accentTheme.value]);

/** 注入每页 page-meta page-style 的变量覆盖串；默认青柠主题也返回显式值，避免 H5 从其他主题切回时旧覆盖残留。 */
const themePageStyle = computed(() => buildAccentThemePageStyle(accentTheme.value));

/** 原生组件（如 switch 的 color 属性）只接受 hex，不接受 CSS 变量。 */
const accentHex = computed(() => palette.value.accent);

function changeAccentTheme(theme: AccentThemeId) {
  accentTheme.value = theme;
  setStoredAccentTheme(theme);
}

export function useAccentTheme() {
  return {
    accentTheme,
    palette,
    themePageStyle,
    accentHex,
    setAccentTheme: changeAccentTheme,
  };
}
