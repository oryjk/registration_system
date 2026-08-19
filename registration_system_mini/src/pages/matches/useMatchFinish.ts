import { computed, ref, type ComputedRef, type Ref } from "vue";
import { updateMatchStatus } from "@/api/match";
import { useNeoConfirmDialog } from "@/components/neo";
import type { AppMatchSummary } from "@/types/match";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { parseDateValue } from "./detailState";

/** 可管理比赛终态的身份：主队队长始终可以；线上约队已确认对手时客队队长也可以。 */
function isMatchFinishCaptain(sourceMatch: AppMatchSummary, currentTeam: TeamProfileViewModel | null): boolean {
  if (!currentTeam || !currentTeam.isCaptain) return false;
  if (currentTeam.id === sourceMatch.host_team_id) return true;
  return (
    sourceMatch.publication_mode === "online_team" &&
    sourceMatch.away_team_id !== null &&
    currentTeam.id === sourceMatch.away_team_id
  );
}

/** 散人约球无主队：发布者本人管理终态（后端按 created_by_user_id 鉴权）。 */
function isMatchCreator(sourceMatch: AppMatchSummary, currentUserId?: number): boolean {
  return sourceMatch.host_team_id === null && sourceMatch.created_by_user_id === currentUserId;
}

function isMatchOwner(sourceMatch: AppMatchSummary, currentTeam: TeamProfileViewModel | null, currentUserId?: number): boolean {
  return isMatchFinishCaptain(sourceMatch, currentTeam) || isMatchCreator(sourceMatch, currentUserId);
}

function isInProgress(sourceMatch: AppMatchSummary): boolean {
  return sourceMatch.status === "registering" || sourceMatch.status === "ongoing";
}

/** 队长收尾比赛的可见条件：新接口详情 + 非终态 + 已过结束时间 + 主/客队队长或散人创建者身份。 */
export function resolveMatchFinishState({
  sourceMatch,
  currentTeam,
  now,
  currentUserId,
}: {
  sourceMatch: AppMatchSummary | null;
  currentTeam: TeamProfileViewModel | null;
  now: number;
  currentUserId?: number;
}) {
  if (!sourceMatch || !isInProgress(sourceMatch)) {
    return { canFinish: false };
  }
  const endTimestamp = parseDateValue(sourceMatch.end_time).getTime();
  if (!Number.isFinite(endTimestamp) || now <= endTimestamp) {
    return { canFinish: false };
  }
  if (!isMatchOwner(sourceMatch, currentTeam, currentUserId)) {
    return { canFinish: false };
  }
  return { canFinish: true };
}

/**
 * 创建者赛前取消比赛的可见条件：非终态 + 未到结束时间 + 主/客队队长或散人创建者身份；
 * 赛前支付（prepaid）的比赛暂不支持取消（后端同样拦截）；过结束时间后由收尾弹窗承接取消。
 */
export function resolveMatchCancelState({
  sourceMatch,
  currentTeam,
  now,
  currentUserId,
}: {
  sourceMatch: AppMatchSummary | null;
  currentTeam: TeamProfileViewModel | null;
  now: number;
  currentUserId?: number;
}) {
  if (!sourceMatch || !isInProgress(sourceMatch)) {
    return { canCancel: false };
  }
  if (sourceMatch.payment_mode === "prepaid") {
    return { canCancel: false };
  }
  const endTimestamp = parseDateValue(sourceMatch.end_time).getTime();
  if (!Number.isFinite(endTimestamp) || now > endTimestamp) {
    return { canCancel: false };
  }
  if (!isMatchOwner(sourceMatch, currentTeam, currentUserId)) {
    return { canCancel: false };
  }
  return { canCancel: true };
}

interface MatchFinishDependencies {
  sourceMatch: Ref<AppMatchSummary | null>;
  currentTeam: ComputedRef<TeamProfileViewModel | null>;
  currentUserId: Ref<number | undefined>;
  isGuestMode: Ref<boolean>;
  submittingStatus: Ref<boolean>;
  nowTick: Ref<number>;
  reload: () => Promise<void>;
}

export function useMatchFinish(dependencies: MatchFinishDependencies) {
  const { sourceMatch, currentTeam, currentUserId, isGuestMode, submittingStatus, nowTick, reload } = dependencies;

  const finishDialogVisible = ref(false);
  const {
    confirmDialogVisible: cancelDialogVisible,
    confirmDialogState: cancelDialogState,
    confirm,
    handleConfirmPrimary: handleCancelPrimary,
    handleConfirmSecondary: handleCancelSecondary,
    handleConfirmClose: handleCancelClose,
  } = useNeoConfirmDialog();

  const canFinishMatch = computed(() => {
    if (isGuestMode.value) return false;
    return resolveMatchFinishState({
      sourceMatch: sourceMatch.value,
      currentTeam: currentTeam.value,
      now: nowTick.value,
      currentUserId: currentUserId.value,
    }).canFinish;
  });

  const canCancelMatch = computed(() => {
    if (isGuestMode.value) return false;
    return resolveMatchCancelState({
      sourceMatch: sourceMatch.value,
      currentTeam: currentTeam.value,
      now: nowTick.value,
      currentUserId: currentUserId.value,
    }).canCancel;
  });

  function handleOpenFinishDialog() {
    if (!canFinishMatch.value || submittingStatus.value) return;
    finishDialogVisible.value = true;
  }

  function handleCloseFinishDialog() {
    if (submittingStatus.value) return;
    finishDialogVisible.value = false;
  }

  async function handleFinishMatch(status: "ended" | "cancelled") {
    const match = sourceMatch.value;
    if (!match || !canFinishMatch.value || submittingStatus.value) return;

    submittingStatus.value = true;
    try {
      const detail = await updateMatchStatus(match.id, status);
      // 状态已提交成功：先让本地收敛到接口返回的比赛，按钮立即消失。
      sourceMatch.value = detail.match;
      finishDialogVisible.value = false;
      uni.showToast({ title: status === "ended" ? "比赛已结束" : "比赛已取消", icon: "none" });
      try {
        // 刷新失败不再当作提交失败提示——重进/下拉刷新即可补齐其余数据。
        await reload();
      } catch {
        // 状态提交本身已成功，静默忽略刷新失败。
      }
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "操作失败，请稍后重试", icon: "none" });
    } finally {
      submittingStatus.value = false;
    }
  }

  /** 赛前取消：danger 二次确认后提交 cancelled；成功后本地收敛并刷新详情。 */
  async function handleCancelMatch() {
    const match = sourceMatch.value;
    if (!match || !canCancelMatch.value) return;
    const confirmed = await confirm({
      title: "取消比赛",
      content: `确定取消「${match.name}」吗？取消后无法恢复，已报名的队员将看到比赛已取消。`,
      highlight: match.name,
      confirmText: "取消比赛",
      cancelText: "再想想",
      danger: true,
    });
    if (!confirmed) return;

    submittingStatus.value = true;
    try {
      const detail = await updateMatchStatus(match.id, "cancelled");
      sourceMatch.value = detail.match;
      uni.showToast({ title: "比赛已取消", icon: "none" });
      try {
        await reload();
      } catch {
        // 提交已成功，静默忽略刷新失败。
      }
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "操作失败，请稍后重试", icon: "none" });
    } finally {
      submittingStatus.value = false;
    }
  }

  return {
    canFinishMatch,
    canCancelMatch,
    finishDialogVisible,
    handleOpenFinishDialog,
    handleCloseFinishDialog,
    handleFinishMatch,
    cancelDialogVisible,
    cancelDialogState,
    handleCancelMatch,
    handleCancelPrimary,
    handleCancelSecondary,
    handleCancelClose,
  };
}
