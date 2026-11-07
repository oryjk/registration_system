import type { AppMatchGroupDetail, AppMatchSummary } from "@/types/match";

export type VenueSideRelease = "withdraw" | "remove";

export interface VenueSideCard {
  groupId: string;
  title: string;
  caption: string;
  releaseAction: VenueSideRelease | null;
}

interface VenueViewer {
  userId?: number;
  teamId?: number | null;
  canManageTeam?: boolean;
}

/** 甲边在前；已取消的组不属于当前对阵。 */
export function activeVenueSides(groups: AppMatchGroupDetail[]): AppMatchGroupDetail[] {
  return groups
    .filter((group) => group.side && group.status !== "cancelled")
    .sort((left, right) => (left.side ?? "").localeCompare(right.side ?? ""));
}

function isViewerSideManager(group: AppMatchGroupDetail, viewer: VenueViewer): boolean {
  return group.team_id != null && group.team_id === viewer.teamId && !!viewer.canManageTeam;
}

function resolveRelease(match: AppMatchSummary, group: AppMatchGroupDetail, viewer: VenueViewer, now: number): VenueSideRelease | null {
  if (group.team_id == null || match.status !== "registering" || now >= new Date(match.start_time).getTime()) return null;
  if (isViewerSideManager(group, viewer)) return "withdraw";
  return match.created_by_user_id != null && match.created_by_user_id === viewer.userId ? "remove" : null;
}

/** 散人边只显示“散人组”，弱化甲乙：散人的边只是名额归属，不代表到场后一定同队。 */
export function toVenueSideCards(match: AppMatchSummary, groups: AppMatchGroupDetail[], viewer: VenueViewer, now: number): VenueSideCard[] {
  return activeVenueSides(groups).map((group) => {
    const minimum = group.min_players ?? match.players_per_team;
    const open = group.team_id == null && group.attending_count === 0;
    return {
      groupId: group.id,
      title: group.team_id != null ? group.side_team_name || "球队" : open ? "虚位以待" : "散人组",
      caption: open ? "球队可占，或由散人填满" : `已报 ${group.attending_count} 人 · ${minimum} 人成行`,
      releaseAction: resolveRelease(match, group, viewer, now),
    };
  });
}

/** 当前球队的队长、领队才能带队占边，同一支球队不能占两边。 */
export function canClaimVenueSide(match: AppMatchSummary, groups: AppMatchGroupDetail[], viewer: VenueViewer, registrationOpen: boolean): boolean {
  if (!registrationOpen || match.status !== "registering" || !viewer.canManageTeam || viewer.teamId == null) return false;
  const sides = activeVenueSides(groups);
  if (sides.some((group) => group.team_id === viewer.teamId)) return false;
  return sides.some((group) => group.team_id == null && group.attending_count === 0);
}
