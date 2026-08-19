import { computed, ref } from "vue";
import { putMiniReviewReviewStatus } from "@/api/miniReview";
import { updateMyProfile } from "@/api/user";
import { useTeamContext } from "@/stores/teamContext";
import { useMiniReviewStatus } from "@/stores/miniReview";
import { MINI_PROGRAM_VERSION } from "@/config/generatedMiniProgramVersion";
import { PRODUCT_OWNER_USER_ID } from "@/config/productOwner";
import { loadMiniAppRuntimeConfig } from "@/config/runtimeConfig";

const MINI_PROJECT_CODE = "registration_system_mini";

/** 「我的 → 设置」页：产品负责人专用的运营/验证工具集合。 */
export function useSettingsPage() {
  const { currentUser, ensureSessionReady, refreshSessionContext } = useTeamContext();
  const { reviewMode, preloadMiniReviewStatus } = useMiniReviewStatus();

  const isLoading = ref(false);
  const clearProfileEnabled = ref(false);
  const reviewToggleEnabled = ref(false);

  const isOwner = computed(() => currentUser.value?.id === PRODUCT_OWNER_USER_ID);
  const currentReviewLabel = computed(() => (reviewMode.value ? "审核中" : "已过审"));

  async function loadPageData() {
    isLoading.value = true;
    try {
      await ensureSessionReady();
      const runtimeConfig = await loadMiniAppRuntimeConfig();
      // 各设置项仍由管理端「系统设置」开关控制，页面只负责收拢入口。
      clearProfileEnabled.value = runtimeConfig.debug.clear_profile_enabled;
      reviewToggleEnabled.value =
        runtimeConfig.debug.review_status_toggle_enabled && isOwner.value;
    } finally {
      isLoading.value = false;
    }
  }

  function confirmDialog(options: { title: string; content: string }): Promise<boolean> {
    return new Promise((resolve) => {
      uni.showModal({
        title: options.title,
        content: options.content,
        confirmText: "确认",
        cancelText: "取消",
        success: (result) => resolve(!!result.confirm),
        fail: () => resolve(false),
      });
    });
  }

  async function handleClearProfile() {
    if (!currentUser.value) return;
    const confirmed = await confirmDialog({
      title: "清除头像和昵称",
      content: "验证用入口：清除后头像和昵称会被清空，回到未完善资料状态。",
    });
    if (!confirmed) return;
    try {
      await updateMyProfile({ nickname: "", avatar_url: "" });
      await refreshSessionContext();
      uni.showToast({ title: "已清除，完善提示应重新出现", icon: "none" });
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "清除失败",
        icon: "none",
      });
    }
  }

  async function handleToggleReviewStatus() {
    const nextReviewing = !reviewMode.value;
    const confirmed = await confirmDialog({
      title: "切换审核状态",
      content: `当前版本 ${MINI_PROGRAM_VERSION} 将切换为「${nextReviewing ? "审核中" : "已过审"}」，全量用户的创建入口显隐会立即变化。`,
    });
    if (!confirmed) return;
    try {
      await putMiniReviewReviewStatus(MINI_PROJECT_CODE, MINI_PROGRAM_VERSION, nextReviewing);
      await preloadMiniReviewStatus(true);
      uni.showToast({
        title: nextReviewing ? "已切为审核中" : "已切为已过审",
        icon: "none",
      });
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "切换失败",
        icon: "none",
      });
    }
  }

  return {
    currentUser,
    isLoading,
    isOwner,
    clearProfileEnabled,
    reviewToggleEnabled,
    currentReviewLabel,
    loadPageData,
    handleClearProfile,
    handleToggleReviewStatus,
  };
}
