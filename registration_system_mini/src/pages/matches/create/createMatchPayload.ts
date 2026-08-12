import type { CreateMatchPayload } from "@/api/match";
import type { MatchPublishFormModel } from "@/components/matchPublishForm";

interface HostTeamInput {
  id: number;
  name: string;
}

export function buildGoCreateMatchPayload(form: MatchPublishFormModel, hostTeam: HostTeamInput): CreateMatchPayload {
  const playersPerTeam = Number(form.playersPerTeam);
  if (!Number.isFinite(playersPerTeam) || playersPerTeam <= 0) {
    throw new Error("比赛人制必须大于 0");
  }

  const opponentName = form.opposing.trim();
  if (form.publicationMode === "offline_confirmed" && !opponentName) {
    throw new Error("线下已约比赛必须填写对手名称");
  }
  const description = form.description.trim();
  const hasCoordinates = form.locationLatitude != null && form.locationLongitude != null;

  return {
    name: form.name.trim(),
    publication_mode: form.publicationMode,
    host_team_id: hostTeam.id,
    ...(form.publicationMode === "offline_confirmed" ? { opponent_name: opponentName } : {}),
    players_per_team: playersPerTeam,
    host_capacity_limit: playersPerTeam + 2,
    start_time: new Date(form.holdingDate).toISOString(),
    end_time: new Date(form.matchEndTime).toISOString(),
    location: form.location.trim(),
    ...(hasCoordinates
      ? { location_latitude: form.locationLatitude!, location_longitude: form.locationLongitude! }
      : {}),
    ...(description ? { description } : {}),
  };
}
