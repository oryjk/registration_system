import { computed, type ComputedRef, type Ref } from "vue";
import { useMiniReviewStatus } from "@/stores/miniReview";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { useNeoConfirmDialog } from "@/components/neo";
import { dissolveTeam } from "./teamManageActions";

interface TeamDissolveDependencies {
  currentTeam: ComputedRef<TeamProfileViewModel | null>;
  submitting: Ref<boolean>;
  refreshSessionContext: () => Promise<void>;
}

/** 解散球队：仅队长本人，danger 确认弹窗兜底；成功后刷新球队上下文并返回上一页。 */
export function useTeamDissolve({ currentTeam, submitting, refreshSessionContext }: TeamDissolveDependencies) {
  const { shouldHideCreationEntrances } = useMiniReviewStatus();
  const {
    confirmDialogVisible: dissolveDialogVisible,
    confirmDialogState: dissolveDialogState,
    confirm,
    handleConfirmPrimary: handleDissolvePrimary,
    handleConfirmSecondary: handleDissolveSecondary,
    handleConfirmClose: handleDissolveClose,
  } = useNeoConfirmDialog();

  // 解散不可恢复：只给队长本人，且小程序审核模式下隐藏入口。
  const canDissolveTeam = computed(
    () => !!currentTeam.value?.isCaptain && !shouldHideCreationEntrances.value && !submitting.value,
  );

  async function handleDissolveTeam() {
    const team = currentTeam.value;
    if (!team) return;
    const confirmed = await confirm({
      title: "解散球队",
      content: `确定解散「${team.name}」吗？解散后全体成员的成员关系将被移除，且无法恢复。球队仍被比赛或约队申请使用时无法解散。`,
      highlight: team.name,
      confirmText: "解散",
      cancelText: "再想想",
      danger: true,
    });
    if (!confirmed) return;

    submitting.value = true;
    try {
      await dissolveTeam(team.id);
      await refreshSessionContext();
      uni.showToast({ title: "球队已解散", icon: "none" });
      setTimeout(() => uni.navigateBack({ delta: 1 }), 600);
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "解散球队失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  return {
    canDissolveTeam,
    dissolveDialogVisible,
    dissolveDialogState,
    handleDissolveTeam,
    handleDissolvePrimary,
    handleDissolveSecondary,
    handleDissolveClose,
  };
}
