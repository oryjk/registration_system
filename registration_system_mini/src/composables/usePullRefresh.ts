import { ref } from "vue";
import { createPageRefresh } from "@/utils/pageRefresh";
import { usePageWindowTheme } from "./usePageWindowTheme";

/**
 * scroll-view refresher 版刷新封装：与 AppPullScrollView 配套使用。
 * 页面把 refreshing / handleRefresherRefresh 绑到组件上；
 * 与 usePageRefresh（原生下拉）互斥，同页只用其一。
 */
export function usePullRefresh(load: () => unknown | Promise<unknown>) {
  usePageWindowTheme();
  const refreshing = ref(false);

  const refresh = createPageRefresh(
    load,
    () => {
      refreshing.value = false;
    },
    error => {
      uni.showToast({ title: error instanceof Error ? error.message : "刷新失败，请重试", icon: "none" });
    },
  );

  function handleRefresherRefresh() {
    refreshing.value = true;
    void refresh();
  }

  return { refreshing, handleRefresherRefresh };
}
