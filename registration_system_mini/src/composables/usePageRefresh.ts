import { onPullDownRefresh } from '@dcloudio/uni-app';
import { createPageRefresh } from '@/utils/pageRefresh';
import { usePageWindowTheme } from './usePageWindowTheme';

/** Call during page setup. The loader must preserve local form drafts. */
export function usePageRefresh(load: () => unknown | Promise<unknown>) {
  usePageWindowTheme();
  const refresh = createPageRefresh(load, () => uni.stopPullDownRefresh(), error => {
    uni.showToast({ title: error instanceof Error ? error.message : '刷新失败，请重试', icon: 'none' });
  });
  onPullDownRefresh(refresh);
  return refresh;
}
