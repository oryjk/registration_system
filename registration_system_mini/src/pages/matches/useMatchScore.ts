import { computed, ref, type ComputedRef, type Ref } from "vue";
import { updateMatchScore } from "@/api/match";
import type { AppMatchSummary } from "@/types/match";

/** 比分可录入的比赛状态：进行中或已结束。 */
function isScoreRecordable(sourceMatch: AppMatchSummary | null): boolean {
  return sourceMatch?.status === "ongoing" || sourceMatch?.status === "ended";
}

/** 比赛管理员可见的「录入比分」入口条件：新接口详情 + 可录入状态。 */
export function resolveMatchScoreState({
  sourceMatch,
  isMatchAdmin,
}: {
  sourceMatch: AppMatchSummary | null;
  isMatchAdmin: boolean;
}) {
  if (!isMatchAdmin || !isScoreRecordable(sourceMatch)) {
    return { canRecordScore: false };
  }
  return { canRecordScore: true };
}

interface MatchScoreDependencies {
  sourceMatch: Ref<AppMatchSummary | null>;
  isMatchAdmin: ComputedRef<boolean>;
  reload: () => Promise<void>;
}

/** 比赛详情页「录入比分」：弹窗内填主/客比分，提交后刷新详情。 */
export function useMatchScore(dependencies: MatchScoreDependencies) {
  const { sourceMatch, isMatchAdmin, reload } = dependencies;

  const dialogVisible = ref(false);
  const hostScore = ref("");
  const awayScore = ref("");
  const isSubmitting = ref(false);

  const canRecordScore = computed(() =>
    resolveMatchScoreState({
      sourceMatch: sourceMatch.value,
      isMatchAdmin: isMatchAdmin.value,
    }).canRecordScore,
  );

  /** 已录入比分时详情页展示比分卡（所有用户可见，仅展示）。 */
  const recordedScore = computed(() => {
    const source = sourceMatch.value;
    if (!source || source.host_score == null || source.away_score == null) return null;
    return { host: source.host_score, away: source.away_score };
  });

  function open() {
    const source = sourceMatch.value;
    hostScore.value = source?.host_score == null ? "" : String(source.host_score);
    awayScore.value = source?.away_score == null ? "" : String(source.away_score);
    dialogVisible.value = true;
  }

  function close() {
    if (isSubmitting.value) return;
    dialogVisible.value = false;
  }

  async function submit() {
    const source = sourceMatch.value;
    if (!source || !canRecordScore.value || isSubmitting.value) return;
    const host = Number(hostScore.value.trim());
    const away = Number(awayScore.value.trim());
    if (!/^\d{1,3}$/.test(hostScore.value.trim()) || !/^\d{1,3}$/.test(awayScore.value.trim())) {
      uni.showToast({ title: "比分需为 0-999 的整数", icon: "none" });
      return;
    }
    isSubmitting.value = true;
    try {
      const detail = await updateMatchScore(source.id, { host_score: host, away_score: away });
      sourceMatch.value = detail.match;
      dialogVisible.value = false;
      uni.showToast({ title: "比分已保存", icon: "none" });
      try {
        await reload();
      } catch {
        // 提交已成功，静默忽略刷新失败。
      }
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "保存失败，请稍后重试", icon: "none" });
    } finally {
      isSubmitting.value = false;
    }
  }

  return { canRecordScore, recordedScore, dialogVisible, hostScore, awayScore, isSubmitting, open, close, submit };
}
