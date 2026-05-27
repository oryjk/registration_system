import type {
  BackendActivity,
  BackendActivityCheckInRecord,
  BackendCreateActivityCheckInConfig,
  BackendActivityListPage,
  BackendLocationSearchResult,
  BackendOngoingActivityResult,
  BackendRegistration,
} from "@/types/backend";
import { buildQueryString } from "@/utils/queryString";
import { requestApi } from "@/utils/request";

export function listActivities(params?: {
  page?: number;
  pageSize?: number;
  status?: number;
  teamId?: number;
  holdingAfter?: string;
}) {
  const queryString = buildQueryString({
    page: params?.page,
    page_size: params?.pageSize,
    status: typeof params?.status === "number" ? params.status : undefined,
    team_id: params?.teamId,
    holding_after: params?.holdingAfter,
  });

  return requestApi<BackendActivityListPage>({
    url: `/activity/infos${queryString ? `?${queryString}` : ""}`,
  });
}

export function checkOngoingActivity() {
  return requestApi<BackendOngoingActivityResult>({
    url: "/activity/check-ongoing",
  });
}

export function getActivity(activityId: string) {
  return requestApi<BackendActivity>({
    url: `/activity/${activityId}`,
  });
}

export function getActivityUsers(activityId: string) {
  return requestApi<BackendRegistration[]>({
    url: `/activity/${activityId}/users`,
  });
}

export function createActivity(payload: {
  name: string;
  location: string;
  location_latitude?: number;
  location_longitude?: number;
  holding_date: string;
  start_time: string;
  end_time: string;
  opposing?: string;
  description?: string;
  home_team_id?: number;
  away_team_id?: number;
  color?: string;
  opposing_color?: string;
  players_per_team?: number;
  match_kind?: "external" | "internal";
  team_checkin_configs?: BackendCreateActivityCheckInConfig[];
}) {
  return requestApi<BackendActivity>({
    url: "/activity",
    method: "POST",
    data: payload,
    auth: true,
  });
}

export function updateActivity(
  activityId: string,
  payload: {
    name?: string;
    location?: string;
    location_latitude?: number | null;
    location_longitude?: number | null;
    holding_date?: string;
    start_time?: string;
    end_time?: string;
    opposing?: string | null;
    description?: string | null;
    home_team_id?: number | null;
    away_team_id?: number | null;
    color?: string | null;
    opposing_color?: string | null;
    players_per_team?: number | null;
    match_kind?: "external" | "internal";
  },
) {
  return requestApi<void>({
    url: `/activity/${activityId}`,
    method: "PATCH",
    data: payload,
    auth: true,
  });
}

export function searchActivityLocations(params: {
  keyword: string;
  limit?: number;
}) {
  const queryString = buildQueryString({
    keyword: params.keyword,
    limit: params.limit,
  });
  return requestApi<BackendLocationSearchResult[]>({
    url: `/activity/location-search${queryString ? `?${queryString}` : ""}`,
    auth: true,
  });
}

export function resolveActivityLocation(params: {
  latitude: number;
  longitude: number;
}) {
  const queryString = buildQueryString({
    latitude: params.latitude,
    longitude: params.longitude,
  });
  return requestApi<BackendLocationSearchResult>({
    url: `/activity/location-resolve${queryString ? `?${queryString}` : ""}`,
    auth: true,
  });
}

export function updateMyStand(activityId: string, payload: { stand: number; registration_count: number }) {
  return requestApi<void>({
    url: `/activity/${activityId}/my-stand`,
    method: "PATCH",
    data: payload,
    auth: true,
  });
}

export function submitTeamRegistration(
  activityId: string,
  payload: {
    team_id: number;
    registration_count: number;
  },
) {
  return requestApi<BackendActivity>({
    url: `/activity/${activityId}/team-registration`,
    method: "POST",
    data: payload,
    auth: true,
  });
}

export function cancelTeamRegistration(activityId: string, payload: { team_id: number }) {
  return requestApi<void>({
    url: `/activity/${activityId}/team-registration`,
    method: "DELETE",
    data: payload,
    auth: true,
  });
}

export function updateTeamCheckInConfig(
  activityId: string,
  payload: {
    team_id: number;
    enabled: boolean;
    radius_meters: number;
    open_minutes_before: number;
    close_minutes_after: number;
  },
) {
  return requestApi<BackendActivity>({
    url: `/activity/${activityId}/check-in-config`,
    method: "PATCH",
    data: payload,
    auth: true,
  });
}

export function submitActivityCheckIn(
  activityId: string,
  payload: {
    team_id: number;
    latitude: number;
    longitude: number;
  },
) {
  return requestApi<BackendActivityCheckInRecord>({
    url: `/activity/${activityId}/check-in`,
    method: "POST",
    data: payload,
    auth: true,
  });
}
