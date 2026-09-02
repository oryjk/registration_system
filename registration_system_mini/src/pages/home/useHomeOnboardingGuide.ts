import { ref } from "vue";
import { loadMiniAppRuntimeConfig } from "@/config/runtimeConfig";
import { preloadMiniReviewStatus, useMiniReviewStatus } from "@/stores/miniReview";
import { useTeamContext } from "@/stores/teamContext";
import { isOnboardingGuideDismissed, markOnboardingGuideDismissed } from "@/utils/onboardingGuideStorage";
import { needsProfileCompletion } from "@/utils/profileCompletion";

type OnboardingRole = "captain" | "player";

// 首屏数据加载完成后到弹出引导的间隔：先让用户看到首页内容，再引导。
const GUIDE_TRIGGER_DELAY_MS = 600;

// 首页新手引导：资料未完善的登录用户在首屏加载完成后选择身份（队长/散人），
// 队长路线引导完善资料 → 创建球队 → 创建后由创建页提示分享邀请；
// 散人路线只引导完善资料。审核态与运营开关（runtime config onboarding.enabled，
// 默认关闭）双重控制；用户主动跳过后本机不再自动弹出。
export function useHomeOnboardingGuide() {
  const { currentUser } = useTeamContext();
  const { shouldHideCreationEntrances } = useMiniReviewStatus();

  const rolePickerVisible = ref(false);
  const profileDialogVisible = ref(false);
  const createTeamPromptVisible = ref(false);
  const activeRole = ref<OnboardingRole>("player");
  // 资料弹窗点「暂不」不算跳过（资料仍未完善，下次冷启动还会引导），但本次会话不再弹。
  let suppressedForSession = false;
  let triggerTimer: ReturnType<typeof setTimeout> | null = null;

  function isFlowActive(): boolean {
    return rolePickerVisible.value || profileDialogVisible.value || createTeamPromptVisible.value;
  }

  async function evaluateAndShow(): Promise<void> {
    if (suppressedForSession || isFlowActive() || isOnboardingGuideDismissed()) {
      return;
    }
    if (!needsProfileCompletion(currentUser.value)) {
      return;
    }
    try {
      // 审核态与配置开关都就绪后再判断；任一请求失败视为本次不引导。
      const [config] = await Promise.all([loadMiniAppRuntimeConfig(), preloadMiniReviewStatus()]);
      if (!config.onboarding.enabled || shouldHideCreationEntrances.value) {
        return;
      }
      if (!needsProfileCompletion(currentUser.value)) {
        return;
      }
      rolePickerVisible.value = true;
    } catch (_error) {
      // 引导是增强体验，配置/审核状态拉取失败时静默放弃。
    }
  }

  /** 首屏数据首次加载成功后调用；延迟弹出避免打断首屏渲染。 */
  function maybeStartAfterFirstLoad(): void {
    if (triggerTimer) {
      clearTimeout(triggerTimer);
    }
    triggerTimer = setTimeout(() => {
      triggerTimer = null;
      void evaluateAndShow();
    }, GUIDE_TRIGGER_DELAY_MS);
  }

  function handleSelectCaptain(): void {
    activeRole.value = "captain";
    rolePickerVisible.value = false;
    profileDialogVisible.value = true;
  }

  function handleSelectPlayer(): void {
    activeRole.value = "player";
    rolePickerVisible.value = false;
    profileDialogVisible.value = true;
  }

  function handleSkip(): void {
    rolePickerVisible.value = false;
    markOnboardingGuideDismissed();
  }

  function handleProfileCompleted(): void {
    profileDialogVisible.value = false;
    if (activeRole.value === "captain") {
      createTeamPromptVisible.value = true;
    }
  }

  function handleProfileCancel(): void {
    profileDialogVisible.value = false;
    suppressedForSession = true;
  }

  function handleCreateTeamConfirmed(): void {
    createTeamPromptVisible.value = false;
    uni.navigateTo({ url: "/pages/teams/create/index?from=onboarding" });
  }

  function handleCreateTeamDeclined(): void {
    createTeamPromptVisible.value = false;
  }

  function dispose(): void {
    if (triggerTimer) {
      clearTimeout(triggerTimer);
      triggerTimer = null;
    }
  }

  return {
    rolePickerVisible,
    profileDialogVisible,
    createTeamPromptVisible,
    maybeStartAfterFirstLoad,
    handleSelectCaptain,
    handleSelectPlayer,
    handleSkip,
    handleProfileCompleted,
    handleProfileCancel,
    handleCreateTeamConfirmed,
    handleCreateTeamDeclined,
    dispose,
  };
}
