import type {
  CreateMatchPayload,
  PublicationMode,
  UpdateMatchPayload,
} from "../types/match";

interface IsoDateTime {
  toISOString(): string;
}

export interface MatchFormPayloadValues {
  name: string;
  publication_mode: PublicationMode;
  host_team_id: number;
  opponent_name?: string;
  players_per_team: number;
  host_capacity_limit?: number;
  time_range: readonly [IsoDateTime, IsoDateTime];
  location: string;
  location_latitude?: number;
  location_longitude?: number;
  description?: string;
}

export function buildUpdateMatchPayload(
  values: MatchFormPayloadValues,
): UpdateMatchPayload {
  return {
    name: values.name.trim(),
    start_time: values.time_range[0].toISOString(),
    end_time: values.time_range[1].toISOString(),
    location: values.location.trim(),
    location_latitude: values.location_latitude ?? null,
    location_longitude: values.location_longitude ?? null,
    description: values.description?.trim() || null,
  };
}

export function buildCreateMatchPayload(
  values: MatchFormPayloadValues,
): CreateMatchPayload {
  return {
    ...buildUpdateMatchPayload(values),
    publication_mode: values.publication_mode,
    host_team_id: values.host_team_id,
    opponent_name:
      values.publication_mode === "offline_confirmed"
        ? values.opponent_name?.trim() || null
        : null,
    players_per_team: values.players_per_team,
    host_capacity_limit: values.host_capacity_limit ?? null,
  };
}
