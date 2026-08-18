import type {
  CreateMatchPayload,
  PublicationMode,
  UpdateMatchPayload,
} from "../types/match";

interface IsoDateTime {
  toISOString(): string;
  valueOf(): number;
}

export interface MatchFormPayloadValues {
  name: string;
  publication_mode: PublicationMode;
  host_team_id: number;
  opponent_name?: string;
  players_per_team: number;
  host_capacity_limit?: number;
  start_time: IsoDateTime;
  duration_minutes: number;
  registration_start_at?: IsoDateTime;
  registration_end_at?: IsoDateTime;
  location: string;
  location_latitude?: number;
  location_longitude?: number;
  description?: string;
  host_color?: string;
  away_color?: string;
  is_free?: boolean;
}

// 主队报名上限默认值：每队人数 + 4，创建表单与未配置容量的编辑回填共用。
export function defaultHostCapacityLimit(playersPerTeam: number): number {
  return playersPerTeam + 4;
}

// 球服颜色统一提交小写 hex6；未设置返回 null（创建走默认，更新表示不改）。
function normalizeJerseyColor(value?: string): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return /^#[0-9a-f]{6}$/.test(trimmed) ? trimmed : null;
}

export function buildUpdateMatchPayload(
  values: MatchFormPayloadValues,
): UpdateMatchPayload {
  return {
    name: values.name.trim(),
    start_time: values.start_time.toISOString(),
    end_time: new Date(
      values.start_time.valueOf() + values.duration_minutes * 60_000,
    ).toISOString(),
    registration_start_at: values.registration_start_at?.toISOString() ?? null,
    registration_end_at: values.registration_end_at?.toISOString() ?? null,
    location: values.location.trim(),
    location_latitude: values.location_latitude ?? null,
    location_longitude: values.location_longitude ?? null,
    description: values.description?.trim() || null,
    opponent_name:
      values.publication_mode === "offline_confirmed"
        ? values.opponent_name?.trim() || null
        : null,
    host_capacity_limit: values.host_capacity_limit ?? null,
    host_color: normalizeJerseyColor(values.host_color),
    away_color: normalizeJerseyColor(values.away_color),
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
    is_free: values.is_free ?? false,
  };
}
