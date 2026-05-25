import type { BackendActivity, BackendUserActivityRecord } from "@/types/backend";
import { formatDateTimeWithWeekdayLabel, formatTimeLabel, parseDateValue } from "@/utils/datetime";
import { matchStatusBadgeTone, type MatchStatusBadgeTone } from "@/utils/statusTone";
import { toStandLabel } from "@/utils/viewModels";

export type UserMatchScope = "future" | "past";

export interface UserMatchCard {
  id: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  venue: string;
  opponent: string;
  formatLabel: string;
  myStatus: string;
  kindLabel: string;
  isEditable: boolean;
  color: string;
  opposingColor: string;
  locationLatitude: number | null;
  locationLongitude: number | null;
  statusTone: MatchStatusBadgeTone;
}

export function buildUserMatchCards(params: {
  activities: BackendActivity[];
  myActivityRecords: BackendUserActivityRecord[];
  activeTeamId?: number;
  scope: UserMatchScope;
  todayStart?: number;
}): UserMatchCard[] {
  const todayStart = params.todayStart ?? todayStartTimestamp();
  const relatedActivityIds = new Set(params.myActivityRecords.map((item) => item.activity_id));
  const recordByActivityId = Object.fromEntries(params.myActivityRecords.map((item) => [item.activity_id, item]));

  return params.activities
    .filter((activity) =>
      params.scope === "future"
        ? parseDateTime(activity.holding_date) >= todayStart
        : parseDateTime(activity.holding_date) < todayStart,
    )
    .filter((activity) => (params.scope === "future" ? activity.status !== 2 && activity.status !== 3 : true))
    .filter((activity) => isRelatedActivity(activity, params.activeTeamId, relatedActivityIds))
    .sort((left, right) =>
      params.scope === "future"
        ? left.holding_date.localeCompare(right.holding_date)
        : right.holding_date.localeCompare(left.holding_date),
    )
    .map((activity) => {
      const myStatus = toStandLabel(recordByActivityId[activity.id]?.stand ?? 0);
      return {
        id: activity.id,
        title: activity.name,
        dateLabel: formatDateTimeWithWeekdayLabel(activity.holding_date),
        timeLabel: formatTimeLabel(activity.start_time || activity.holding_date),
        venue: activity.location,
        opponent: activity.opposing?.trim() || "对手待定",
        formatLabel: activity.players_per_team ? `${activity.players_per_team} 人制` : "人数待定",
        myStatus,
        kindLabel: activity.match_kind === "internal" ? "队内内战" : "对外友谊赛",
        isEditable: isPublisherEditable(activity, params.activeTeamId),
        color: activity.color?.trim() || "#2F6BFF",
        opposingColor: activity.opposing_color?.trim() || "#C8FF00",
        locationLatitude: activity.location_latitude ?? null,
        locationLongitude: activity.location_longitude ?? null,
        statusTone: matchStatusBadgeTone(myStatus),
      };
    });
}

function parseDateTime(value: string) {
  return parseDateValue(value).getTime();
}

function todayStartTimestamp() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function isRelatedActivity(activity: BackendActivity, activeTeamId: number | undefined, relatedActivityIds: Set<string>) {
  return (
    relatedActivityIds.has(activity.id) ||
    (!!activeTeamId && (activity.home_team_id === activeTeamId || activity.away_team_id === activeTeamId))
  );
}

function isPublisherEditable(activity: BackendActivity, activeTeamId?: number) {
  if (!activeTeamId) return false;
  if (activity.source_activity_id) return false;
  if (activity.status === 2 || activity.status === 3) return false;
  return activity.home_team_id === activeTeamId;
}
