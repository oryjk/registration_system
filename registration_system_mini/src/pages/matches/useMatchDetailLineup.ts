import { computed, ref, watch, type Ref } from "vue";
import { getMatchLineup } from "@/api/lineup";
import type { MatchLineupPlayer, MatchLineupRecord } from "@/types/lineup";
import type { AppMatchSummary } from "@/types/match";
import { getFormation } from "./lineup/formations";
import { buildPitchSlots, findCurrentUserRole } from "./lineup/helpers";

export interface UseMatchDetailLineupOptions {
  matchId: Ref<string>;
  sourceMatch: Ref<AppMatchSummary | null>;
  isGuestMode: Ref<boolean>;
  currentUserId: Ref<number | null | undefined>;
}

/**
 * 仅微信小程序端在比赛详情页静默拉取已保存的本场阵型：
 * - 队长/领队始终在「比赛管理」区看到「排阵型」按钮；
 * - 一旦阵型已保存，所有登录队员/替补可在详情页直接看到本场阵型摘要及个人首发/替补身份并进入只读查看。
 * - 接口失败或旧后端未上线时静默回落 null，不影响比赛详情页主流程。
 */
export function useMatchDetailLineup(options: UseMatchDetailLineupOptions) {
  const savedLineup = ref<MatchLineupRecord | null>(null);
  let requestSeq = 0;

  async function refreshLineup(): Promise<void> {
    // #ifdef MP-WEIXIN
    const id = options.sourceMatch.value?.id || options.matchId.value;
    if (!id) {
      savedLineup.value = null;
      return;
    }
    const seq = ++requestSeq;
    try {
      const response = await getMatchLineup(id);
      if (seq !== requestSeq) return;
      savedLineup.value = response?.lineup ?? null;
    } catch {
      if (seq === requestSeq) {
        savedLineup.value = null;
      }
    }
    // #endif
  }

  watch(
    () => [options.sourceMatch.value?.id || options.matchId.value, options.isGuestMode.value] as const,
    () => {
      void refreshLineup();
    },
    { immediate: true },
  );

  const lineupSummaryText = computed(() => {
    const lineup = savedLineup.value;
    if (!lineup) return "";
    return `${lineup.players_per_team}人制 · ${lineup.formation}`;
  });

  const myLineupRoleText = computed(() => {
    const lineup = savedLineup.value;
    const userId = options.currentUserId.value;
    if (!lineup || !userId) return "";
    const playersById: Record<number, MatchLineupPlayer> = {};
    for (const player of lineup.players ?? []) {
      playersById[player.user_id] = player;
    }
    const formationSlots = getFormation(lineup.players_per_team, lineup.formation);
    const pitchSlots = buildPitchSlots(lineup.slots ?? [], formationSlots, playersById);
    const role = findCurrentUserRole(pitchSlots, userId);
    if (!role) return "";
    if (role.kind === "starter") {
      return `你是本场首发 · ${role.label}`;
    }
    const starterName = role.starter?.nickname?.trim();
    return starterName
      ? `你是 ${starterName}（${role.label}）的替补`
      : `你是 ${role.label} 位置的替补`;
  });

  return {
    savedLineup,
    lineupSummaryText,
    myLineupRoleText,
    refreshLineup,
  };
}
