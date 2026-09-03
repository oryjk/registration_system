import { computed, type Ref } from "vue";
import type { AppMatchSummary } from "@/types/match";
import type { BackendTeam } from "@/types/backend";

// 比赛详情对阵区的主/客队 Logo：优先用比赛详情 DTO 自带的 logo（对非成员也可见，
// 不依赖仅成员可读的球队详情接口），回落 teamsById 缓存；散人约球或都取不到时为空，
// UI 回落球服色条。
export function useMatchTeamLogos(options: {
  sourceMatch: Ref<AppMatchSummary | null>;
  teamsById: Ref<Record<number, BackendTeam>>;
  opponentTeam: Ref<BackendTeam | null>;
  isPickupMatch: Ref<boolean>;
}) {
  const { sourceMatch, teamsById, opponentTeam, isPickupMatch } = options;

  const homeTeamLogoUrl = computed(() => {
    if (isPickupMatch.value) return "";
    const dtoLogo = sourceMatch.value?.host_team_logo_url?.trim();
    if (dtoLogo) return dtoLogo;
    const hostTeamId = sourceMatch.value?.host_team_id;
    return (typeof hostTeamId === "number" ? teamsById.value[hostTeamId]?.logo_url : "")?.trim() || "";
  });

  const awayTeamLogoUrl = computed(() => {
    if (isPickupMatch.value) return "";
    const dtoLogo = sourceMatch.value?.away_team_logo_url?.trim();
    if (dtoLogo) return dtoLogo;
    const awayTeamId = sourceMatch.value?.away_team_id;
    const awayTeam = typeof awayTeamId === "number" ? teamsById.value[awayTeamId] : undefined;
    return (awayTeam ?? opponentTeam.value)?.logo_url?.trim() || "";
  });

  return { homeTeamLogoUrl, awayTeamLogoUrl };
}
