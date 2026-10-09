import { avatarParticipationTier } from "@/components/ui/avatarParticipationTier";
import type { BackendTeamAttendanceRankingItem } from "@/types/backend";
import type { AvatarItem } from "@/components/ui/avatarTypes";
import { sortParticipationRanking } from "./teamStatsState";

/** Ranking follows its period; tiers always follow this team's cumulative stars. */
export function buildActivityRanking(
  items: BackendTeamAttendanceRankingItem[],
  cumulativeItems: BackendTeamAttendanceRankingItem[],
) {
  const cumulativeStars = new Map(cumulativeItems.map((item) => [item.user_id, item.participation_points]));
  return sortParticipationRanking(items).map((item) => ({
    ...item,
    cumulativeParticipationPoints: cumulativeStars.get(item.user_id),
    tier: avatarParticipationTier(cumulativeStars.get(item.user_id)),
  }));
}

export function activityRankingAvatar(
  item: BackendTeamAttendanceRankingItem,
  teamId: number,
  cumulativeStars: number | undefined,
): AvatarItem {
  return {
    id: item.user_id,
    teamId,
    name: item.user_name,
    avatarUrl: item.avatar_url ?? undefined,
    teamCumulativeParticipationPoints: cumulativeStars,
  };
}
