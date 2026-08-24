import { ref } from "vue";
import { useTeamContext } from "@/stores/teamContext";
import { resumeSessionBootstrap } from "@/stores/appSession";

interface MatchGuestLoginDependencies {
  /** 登录成功后重载当前详情（由页面的事件监听触发）。 */
  reload: () => Promise<void>;
}

/** 详情页游客登录：CTA 触发的静默微信登录，以及登录完成事件后的页面重载回调。 */
export function useMatchGuestLogin({ reload }: MatchGuestLoginDependencies) {
  const { currentUser, currentTeam, refreshSessionContext } = useTeamContext();
  const isGuestLoginSubmitting = ref(false);

  function getCurrentPageRoute() {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    return currentPage?.route ? `/${currentPage.route}` : "";
  }

  async function handleGuestLogin() {
    if (isGuestLoginSubmitting.value) return;

    isGuestLoginSubmitting.value = true;
    const fromRoute = getCurrentPageRoute();
    resumeSessionBootstrap();
    uni.showLoading({ title: "登录中...", mask: true });
    try {
      await refreshSessionContext();
      // H5 无微信登录通道时 ensureSessionReady 静默返回：留在原地明确提示，不发登录完成事件。
      if (!currentUser.value) {
        uni.showToast({ title: "当前环境暂不支持微信登录，请在微信小程序中操作", icon: "none", duration: 3000 });
        return;
      }
      uni.$emit("session:login-completed", { fromRoute });
      if (!currentTeam.value) {
        uni.switchTab({ url: "/pages/user/index" });
      }
    } catch (_error) {
      uni.switchTab({ url: "/pages/user/index" });
    } finally {
      uni.hideLoading();
      isGuestLoginSubmitting.value = false;
    }
  }

  // 浮动登录条在本页登录成功后只广播事件；详情页自己监听并重载，游客视图/错误文案才会消失。
  function handleSessionLoginCompleted() {
    void reload();
  }

  return {
    isGuestLoginSubmitting,
    handleGuestLogin,
    handleSessionLoginCompleted,
  };
}
