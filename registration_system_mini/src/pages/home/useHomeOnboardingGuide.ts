import { ref, watch } from "vue";
import { useTeamContext } from "@/stores/teamContext";
import {
  clearOnboardingIntent,
  getOnboardingIntent,
  isOnboardingGuideDismissed,
  markOnboardingGuideDismissed,
  restoreOnboardingGuide,
  setOnboardingIntent,
  type OnboardingIntent,
} from "@/utils/onboardingGuideStorage";

// 首页常驻任务指引，不再根据头像/昵称决定是否自动弹窗。
// 选择、收起按账号保存；资料补全仍由具体的加入/报名动作按需触发。
export function useHomeOnboardingGuide() {
  const { currentUser, teamProfiles } = useTeamContext();
  const intent = ref<OnboardingIntent | null>(null);
  const collapsed = ref(false);
  const currentUserId = () => currentUser.value?.id ?? null;

  const stopUserWatch = watch(currentUserId, (userId) => {
    intent.value = getOnboardingIntent(userId);
    collapsed.value = isOnboardingGuideDismissed(userId);
  }, { immediate: true });

  // appSession 在当前账号球队请求完成后清理持久化 intent。
  // 完整 profiles 变化时重读，兼顾同数量切号；不凭上一账号残留球队清理新账号。
  const stopTeamWatch = watch(teamProfiles, () => {
    intent.value = getOnboardingIntent(currentUserId());
  });

  function setIntent(nextIntent: OnboardingIntent): void {
    const userId = currentUserId();
    if (!userId) return;
    intent.value = nextIntent;
    setOnboardingIntent(userId, nextIntent);
  }

  function expand(): void {
    collapsed.value = false;
    restoreOnboardingGuide(currentUserId());
  }

  function collapse(): void {
    collapsed.value = true;
    markOnboardingGuideDismissed(currentUserId());
  }

  function resetIntent(): void {
    clearOnboardingIntent(currentUserId());
    intent.value = null;
    expand();
  }

  function dispose(): void {
    stopUserWatch();
    stopTeamWatch();
  }

  return { intent, collapsed, setIntent, resetIntent, expand, collapse, dispose };
}
