import { ref, type Ref } from "vue";
import { updateMyMatch } from "@/api/match";
import { pad, parseDateValue } from "@/utils/datetime";
import type { AppMatchSummary } from "@/types/match";
import type { MatchTeamGroupSummary } from "@/pages/matches/detailData";

export type MatchEditScheduleCheck = "ok" | "invalid-range" | "past-time";

/** 保存前的时间检查：结束必须晚于开始；开始时间早于当前时刻需要用户二次确认。 */
export function resolveMatchEditScheduleCheck(startTime: number, endTime: number, now: number): MatchEditScheduleCheck {
  if (!startTime || !endTime || endTime <= startTime) return "invalid-range";
  if (startTime < now) return "past-time";
  return "ok";
}

function parseBackendTimestamp(value?: string | null): number {
  if (!value) return 0;
  const timestamp = parseDateValue(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatFullDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 比赛详情页「修改比赛」弹窗：编辑对手名称、主队报名组人数上限与比赛起止时间。 */
export function useMatchEdit(params: {
  sourceMatch: Ref<AppMatchSummary | null>;
  matchTeamGroups: Ref<MatchTeamGroupSummary[]>;
  reload: () => Promise<void> | void;
}) {
  const dialogVisible = ref(false);
  const opponentName = ref("");
  const maxPlayers = ref("");
  const startTime = ref(0);
  const endTime = ref(0);
  /** 开始时间早于当前时间时的二次确认弹窗（叠加在编辑弹窗之上）。 */
  const pastTimeDialogVisible = ref(false);
  const pastTimeMessage = ref("");
  const isSubmitting = ref(false);

  function open() {
    const source = params.sourceMatch.value;
    if (!source) return;
    const hostGroup = params.matchTeamGroups.value.find((group) => group.kind === "host_team");
    opponentName.value = source.opponent_name ?? "";
    maxPlayers.value = String(hostGroup?.maxPlayers ?? source.players_per_team ?? "");
    startTime.value = parseBackendTimestamp(source.start_time);
    endTime.value = parseBackendTimestamp(source.end_time);
    dialogVisible.value = true;
  }

  function close() {
    if (isSubmitting.value) return;
    dialogVisible.value = false;
  }

  async function doSubmit(limit: number) {
    const source = params.sourceMatch.value;
    if (!source || isSubmitting.value) return;
    isSubmitting.value = true;
    try {
      await updateMyMatch(source.id, {
        opponent_name: opponentName.value.trim(),
        max_players: limit,
        start_time: new Date(startTime.value).toISOString(),
        end_time: new Date(endTime.value).toISOString(),
      });
      dialogVisible.value = false;
      uni.showToast({ title: "比赛已更新", icon: "none" });
      uni.$emit("home:data-may-changed");
      await params.reload();
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
    } finally {
      isSubmitting.value = false;
    }
  }

  async function submit() {
    const limit = Number(maxPlayers.value.trim());
    if (Number.isNaN(limit) || limit <= 0) {
      uni.showToast({ title: "请填写有效的人数上限", icon: "none" });
      return;
    }
    const check = resolveMatchEditScheduleCheck(startTime.value, endTime.value, Date.now());
    if (check === "invalid-range") {
      uni.showToast({ title: "结束时间必须晚于开始时间", icon: "none" });
      return;
    }
    if (check === "past-time") {
      pastTimeMessage.value = `所选开始时间 ${formatFullDateTime(startTime.value)} 早于当前时间，请确认没有选错。`;
      pastTimeDialogVisible.value = true;
      return;
    }
    await doSubmit(limit);
  }

  /** 过去时间二次确认：确认后按当前表单值继续提交。 */
  async function confirmPastTimeSubmit() {
    pastTimeDialogVisible.value = false;
    const limit = Number(maxPlayers.value.trim());
    if (Number.isNaN(limit) || limit <= 0) return;
    await doSubmit(limit);
  }

  function cancelPastTimeSubmit() {
    if (isSubmitting.value) return;
    pastTimeDialogVisible.value = false;
  }

  return {
    dialogVisible, opponentName, maxPlayers, startTime, endTime,
    pastTimeDialogVisible, pastTimeMessage, isSubmitting,
    open, close, submit, confirmPastTimeSubmit, cancelPastTimeSubmit,
  };
}
