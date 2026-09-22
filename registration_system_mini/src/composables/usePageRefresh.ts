import { watch } from "vue";
import { useAccentTheme } from "@/stores/theme";
import { getThemeWindowBackground } from "@/config/themePalettes";
import { onHide, onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import { createPageRefresh } from '@/utils/pageRefresh';

/** Call during page setup. The loader must preserve local form drafts. */
export function usePageRefresh(load: () => unknown | Promise<unknown>) {
  const { accentTheme } = useAccentTheme();
  let visible = false;
  function syncWindowBackground() {
    // #ifdef MP-WEIXIN
    const color = getThemeWindowBackground(accentTheme.value);
    uni.setBackgroundColor({ backgroundColor: color, backgroundColorTop: color, backgroundColorBottom: color });
    uni.setBackgroundTextStyle({ textStyle: accentTheme.value === 'night' ? 'light' : 'dark' });
    // #endif
  }
  onShow(() => { visible = true; syncWindowBackground(); });
  onHide(() => { visible = false; });
  watch(accentTheme, () => { if (visible) syncWindowBackground(); });
  const refresh = createPageRefresh(load, () => uni.stopPullDownRefresh(), error => {
    uni.showToast({ title: error instanceof Error ? error.message : '刷新失败，请重试', icon: 'none' });
  });
  onPullDownRefresh(refresh);
  return refresh;
}
