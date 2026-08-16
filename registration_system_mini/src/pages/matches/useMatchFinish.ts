import { computed, ref, type ComputedRef, type Ref } from "vue";
import { updateMatchStatus } from "@/api/match";
import type { AppMatchSummary } from "@/types/match";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { parseDateValue } from "./detailState";

/** 可收尾比赛的管理身份：主队管理方始终可以；线上约队已确认对手时客队管理方也可以。 */
function isMatchFinishManager(sourceMatch: AppMatchSummary, currentTeam: TeamProfileViewModel | null): boolean {
  if (!currentTeam || !currentTeam.canManageTeam) return false;
  if (currentTeam.id === sourceMatch.host_team_id) return true;
  return (
    sourceMatch.publication_mode === "online_team" &&
    sourceMatch.away_team_id !== null &&
    currentTeam.id === sourceMatch.away_team_id
  );
}

/** 管理方收尾比赛的可见条件：新接口详情 + 非终态 + 已过结束时间 + 主/客队管理身份。 */
export function resolveMatchFinishState({
  sourceMatch,
  currentTeam,
  now,
}: {
  sourceMatch: AppMatchSummary | null;
  currentTeam: TeamProfileViewModel | null;
  now: number;
}) {
  if (!sourceMatch) return { canFinish: false };
  if (sourceMatch.status !== "registering" && sourceMatch.status !== "ongoing") {
    return { canFinish: false };
  }
  const endTimestamp = parseDateValue(sourceMatch.end_time).getTime();
  if (!Number.isFinite(endTimestamp) || now <= endTimestamp) {
    return { canFinish: false };
  }
  if (!isMatchFinishManager(sourceMatch, currentTeam)) {
    return { canFinish: false };
  }
  return { canFinish: true };
}

interface MatchFinishDependencies {
  sourceMatch: Ref<AppMatchSummary | null>;
  currentTeam: ComputedRef<TeamProfileViewModel | null>;
  isGuestMode: Ref<boolean>;
  submittingStatus: Ref<boolean>;
  nowTick: Ref<number>;
  reload: () => Promise<void>;
}

export function useMatchFinish(dependencies: MatchFinishDependencies) {
  const { sourceMatch, currentTeam, isGuestMode, submittingStatus, nowTick, reload } = dependencies;

  const finishDialogVisible = ref(false);

  const canFinishMatch = computed(() => {
    if (isGuestMode.value) return false;
    return resolveMatchFinishState({
      sourceMatch: sourceMatch.value,
      currentTeam: currentTeam.value,
      now: nowTick.value,
    }).canFinish;
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
      await updateMatchStatus(match.id, status);
      finishDialogVisible.value = false;
      uni.showToast({ title: status === "ended" ? "比赛已结束" : "比赛已取消", icon: "none" });
      await reload();
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "操作失败，请稍后重试", icon: "none" });
    } finally {
      submittingStatus.value = false;
    }
  }

  return {
    canFinishMatch,
    finishDialogVisible,
    handleOpenFinishDialog,
    handleCloseFinishDialog,
    handleFinishMatch,
  };
}
