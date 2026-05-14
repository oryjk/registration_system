import type { BackendActivity, BackendUserActivityRecord } from "@/types/backend";
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
  statusTone: "default" | "success" | "warning" | "muted";
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
        dateLabel: formatDateLabel(activity.holding_date),
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
        statusTone: statusTone(myStatus),
      };
    });
}

function parseDateTime(value: string) {
  return new Date(value.replace(" ", "T")).getTime();
}

function todayStartTimestamp() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatDateLabel(isoText: string) {
  const date = new Date(isoText.replace(" ", "T"));
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()] ?? "";
  return `${month}/${day} ${weekday} ${hours}:${minutes}`;
}

function formatTimeLabel(isoText: string) {
  const date = new Date(isoText.replace(" ", "T"));
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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

function statusTone(status: string) {
  if (status === "参加") return "success";
  if (status === "请假") return "warning";
  if (status === "缺席") return "warning";
  return "muted";
}
