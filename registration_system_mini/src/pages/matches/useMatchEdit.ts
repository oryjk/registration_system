import { ref, type Ref } from "vue";
import { updateMyMatch } from "@/api/match";
import type { AppMatchSummary } from "@/types/match";
import type { MatchTeamGroupSummary } from "@/pages/matches/detailData";

/** 比赛详情页「修改比赛」弹窗：编辑对手名称与主队报名组人数上限。 */
export function useMatchEdit(params: {
  sourceMatch: Ref<AppMatchSummary | null>;
  matchTeamGroups: Ref<MatchTeamGroupSummary[]>;
  reload: () => Promise<void> | void;
}) {
  const dialogVisible = ref(false);
  const opponentName = ref("");
  const maxPlayers = ref("");
  const isSubmitting = ref(false);

  function open() {
    const source = params.sourceMatch.value;
    if (!source) return;
    const hostGroup = params.matchTeamGroups.value.find((group) => group.kind === "host_team");
    opponentName.value = source.opponent_name ?? "";
    maxPlayers.value = String(hostGroup?.maxPlayers ?? source.players_per_team ?? "");
    dialogVisible.value = true;
  }

  function close() {
    if (isSubmitting.value) return;
    dialogVisible.value = false;
  }

  async function submit() {
    const source = params.sourceMatch.value;
    const limit = Number(maxPlayers.value.trim());
    if (!source || Number.isNaN(limit) || limit <= 0) {
      uni.showToast({ title: "请填写有效的人数上限", icon: "none" });
      return;
    }
    if (isSubmitting.value) return;
    isSubmitting.value = true;
    try {
      await updateMyMatch(source.id, {
        opponent_name: opponentName.value.trim(),
        max_players: limit,
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

  return { dialogVisible, opponentName, maxPlayers, isSubmitting, open, close, submit };
}
