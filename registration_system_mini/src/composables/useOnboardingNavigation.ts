import { ref } from "vue";
import { resumeSessionBootstrap, useAppSession } from "@/stores/appSession";

/** 用户主动点击任务入口时登录，成功后继续目标操作；不写入引导身份。 */
export function useOnboardingNavigation() {
  const { currentUser, refreshSessionContext } = useAppSession();
  const busy = ref(false);

  async function navigateTo(url: string): Promise<boolean> {
    if (busy.value) return false;
    busy.value = true;
    let showingLoading = false;
    try {
      if (!currentUser.value) {
        resumeSessionBootstrap();
        uni.showLoading({ title: "登录中...", mask: true });
        showingLoading = true;
        await refreshSessionContext();
        if (!currentUser.value) {
          uni.showToast({ title: "当前环境暂不支持微信登录，请在微信小程序中操作", icon: "none", duration: 3000 });
          return false;
        }
        const pages = getCurrentPages();
        const route = pages[pages.length - 1]?.route;
        uni.$emit("session:login-completed", { fromRoute: route ? `/${route}` : "" });
        uni.hideLoading();
        showingLoading = false;
      }
      await new Promise<void>((resolve, reject) => {
        uni.navigateTo({ url, success: () => resolve(), fail: () => reject(new Error("页面打开失败，请重试")) });
      });
      return true;
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "登录失败，请重试", icon: "none" });
      return false;
    } finally {
      if (showingLoading) uni.hideLoading();
      busy.value = false;
    }
  }

  return { busy, navigateTo };
}
