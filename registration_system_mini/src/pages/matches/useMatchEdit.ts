import { ref, type Ref } from "vue";
import { updateMyMatch } from "@/api/match";
import { MATCH_PUBLICATION_MODE_OPTIONS } from "@/utils/matchPublicationMode";
import { pad, parseDateValue } from "@/utils/datetime";
import type { AppMatchPublicationMode, AppMatchSummary } from "@/types/match";
import type { MatchTeamGroupSummary } from "@/pages/matches/detailData";

export type MatchEditScheduleCheck = "ok" | "invalid-range" | "past-time";

/** 保存前的时间检查：结束必须晚于开始；开始时间早于当前时刻需要用户二次确认。 */
export function resolveMatchEditScheduleCheck(startTime: number, endTime: number, now: number): MatchEditScheduleCheck {
  if (!startTime || !endTime || endTime <= startTime) return "invalid-range";
  if (startTime < now) return "past-time";
  return "ok";
}

export interface MatchTypeChangeState {
  /** 仅线上约队且尚无球队接招时开放类型切换。 */
  visible: boolean;
  /** 可选类型（含当前类型，选中当前类型即不修改）。 */
  options: Array<{ value: AppMatchPublicationMode; label: string }>;
}

export function resolveMatchTypeChangeState(source: Pick<AppMatchSummary, "publication_mode" | "opponent_state">): MatchTypeChangeState {
  return {
    visible: source.publication_mode === "online_team" && source.opponent_state === "recruiting",
    options: MATCH_PUBLICATION_MODE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
  };
}

/** 类型切换的对手名称约束：线下已约必须有名称，散人对手不能带名称。 */
export function validateMatchTypeChange(target: AppMatchPublicationMode | null, opponentName: string): string | null {
  if (!target || target === "online_team") return null;
  if (target === "offline_confirmed" && !opponentName.trim()) return "改为「线下已约」需填写对手名称";
  if (target === "online_individual" && opponentName.trim()) return "「散人对手」不能填写对手名称，请先清空";
  return null;
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
  /** 比赛类型（仅线上约队招募中可切换；初始为当前类型，保持不变即不提交）。 */
  const publicationMode = ref<AppMatchPublicationMode>("online_team");
  const typeChangeState = ref<MatchTypeChangeState>({ visible: false, options: [] });
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
    typeChangeState.value = resolveMatchTypeChangeState(source);
    publicationMode.value = source.publication_mode;
    dialogVisible.value = true;
  }

  function close() {
    if (isSubmitting.value) return;
    dialogVisible.value = false;
  }

  /** 弹窗类型选择回调：只接受当前开放的选项值。 */
  function setPublicationMode(value: string) {
    const option = typeChangeState.value.options.find((item) => item.value === value);
    if (option) publicationMode.value = option.value;
  }

  async function doSubmit(limit: number) {
    const source = params.sourceMatch.value;
    if (!source || isSubmitting.value) return;
    const modeChanged = typeChangeState.value.visible && publicationMode.value !== source.publication_mode;
    isSubmitting.value = true;
    try {
      await updateMyMatch(source.id, {
        opponent_name: opponentName.value.trim(),
        max_players: limit,
        start_time: new Date(startTime.value).toISOString(),
        end_time: new Date(endTime.value).toISOString(),
        ...(modeChanged ? { publication_mode: publicationMode.value } : {}),
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
    const source = params.sourceMatch.value;
    const modeChanged = !!source && typeChangeState.value.visible && publicationMode.value !== source.publication_mode;
    const modeError = modeChanged ? validateMatchTypeChange(publicationMode.value, opponentName.value) : null;
    if (modeError) {
      uni.showToast({ title: modeError, icon: "none" });
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
    publicationMode, typeChangeState, setPublicationMode,
    pastTimeDialogVisible, pastTimeMessage, isSubmitting,
    open, close, submit, confirmPastTimeSubmit, cancelPastTimeSubmit,
  };
}
