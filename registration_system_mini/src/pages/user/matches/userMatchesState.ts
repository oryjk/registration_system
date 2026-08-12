import type { AppMatchSummary, AppMatchUiPhase } from "@/types/match";
import { formatDateTimeWithWeekdayLabel, formatTimeLabel, parseDateValue } from "@/utils/datetime";
import type { MatchStatusBadgeTone } from "@/utils/statusTone";
import { resolveMatchPhase } from "@/pages/home/homeMatchState";
import { getMatchPublicationModeLabel } from "@/utils/matchPublicationMode";

export type UserMatchScope = "future" | "past";

export interface UserMatchCard {
  id: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  venue: string;
  opponent: string;
  formatLabel: string;
  statusLabel: string;
  kindLabel: string;
  publicationModeLabel: string;
  color: string;
  opposingColor: string;
  locationLatitude: number | null;
  locationLongitude: number | null;
  statusTone: MatchStatusBadgeTone;
}

function statusLabel(phase: Exclude<AppMatchUiPhase, "excluded">): string {
  switch (phase) {
    case "ongoing":
      return "进行中";
    case "ended":
      return "已结束";
    default:
      return "报名中";
  }
}

function statusTone(phase: Exclude<AppMatchUiPhase, "excluded">): MatchStatusBadgeTone {
  switch (phase) {
    case "upcoming":
      return "success";
    case "ongoing":
      return "warning";
    default:
      return "muted";
  }
}

export function buildUserMatchCards(params: {
  matches: AppMatchSummary[];
  scope: UserMatchScope;
  now?: Date;
}): UserMatchCard[] {
  const now = params.now ?? new Date();

  return params.matches
    .map((match) => ({ match, phase: resolveMatchPhase(match, now) }))
    .filter(({ phase }) => phase !== "excluded")
    .filter(({ phase }) => (params.scope === "future" ? phase !== "ended" : phase === "ended"))
    .sort((left, right) => {
      const leftTime = parseDateValue(params.scope === "future" ? left.match.start_time : left.match.end_time).getTime();
      const rightTime = parseDateValue(params.scope === "future" ? right.match.start_time : right.match.end_time).getTime();
      return params.scope === "future" ? leftTime - rightTime : rightTime - leftTime;
    })
    .map(({ match, phase }) => {
      const visiblePhase = phase as Exclude<AppMatchUiPhase, "excluded">;
      return {
        id: match.id,
        title: match.name,
        dateLabel: formatDateTimeWithWeekdayLabel(match.start_time),
        timeLabel: formatTimeLabel(match.start_time),
        venue: match.location,
        opponent: match.away_team_name?.trim() || match.opponent_name?.trim() || "对手待定",
        formatLabel: match.players_per_team ? `${match.players_per_team} 人制` : "人数待定",
        statusLabel: statusLabel(visiblePhase),
        kindLabel: getMatchPublicationModeLabel(match.publication_mode),
        publicationModeLabel: getMatchPublicationModeLabel(match.publication_mode),
        color: "#2F6BFF",
        opposingColor: "#C8FF00",
        locationLatitude: match.location_latitude,
        locationLongitude: match.location_longitude,
        statusTone: statusTone(visiblePhase),
      };
    });
}
