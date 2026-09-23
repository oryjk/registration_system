import { watch } from "vue";
import { onHide, onShow } from "@dcloudio/uni-app";
import { getThemeWindowBackground } from "@/config/themePalettes";
import { useAccentTheme } from "@/stores/theme";

/** Keep the native mini-program window in sync with the current page theme. */
export function usePageWindowTheme() {
  const { accentTheme } = useAccentTheme();
  let visible = false;

  function syncWindowTheme() {
    // #ifdef MP-WEIXIN
    const theme = accentTheme.value;
    const color = getThemeWindowBackground(theme);
    uni.setBackgroundColor({ backgroundColor: color, backgroundColorTop: color, backgroundColorBottom: color });
    uni.setBackgroundTextStyle({ textStyle: theme === "night" ? "light" : "dark" });
    // #endif
  }

  onShow(() => {
    visible = true;
    syncWindowTheme();
  });
  onHide(() => {
    visible = false;
  });
  watch(accentTheme, () => {
    if (visible) syncWindowTheme();
  });
}
