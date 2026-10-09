import { avatarParticipationTier } from "@/components/ui/avatarParticipationTier";
import type { BackendTeamAttendanceRankingItem } from "@/types/backend";
import { sortParticipationRanking } from "./teamStatsState";

/** Ranking follows its period; tiers always follow this team's cumulative stars. */
export function buildActivityRanking(
  items: BackendTeamAttendanceRankingItem[],
  cumulativeItems: BackendTeamAttendanceRankingItem[],
) {
  const cumulativeStars = new Map(cumulativeItems.map((item) => [item.user_id, item.participation_points]));
  return sortParticipationRanking(items).map((item) => ({
    ...item,
    tier: avatarParticipationTier(cumulativeStars.get(item.user_id)),
  }));
}
