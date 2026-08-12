import type {
  AppMatchDetailResponse,
  AppMatchHomeResponse,
  AppMatchListResponse,
  AppMatchListScope,
  AppMatchRegistration,
  AppMatchSummary,
} from "@/types/match";
import { buildQueryString } from "@/utils/queryString";
import { requestApi } from "@/utils/request";

export function getMatchHome() {
  return requestApi<AppMatchHomeResponse>({ url: "/matches/home", auth: true });
}

export interface ListMatchesParams {
  scope: AppMatchListScope;
  startsAfter?: Date | string;
  page: number;
  pageSize: number;
}

export function listMatches(params: ListMatchesParams) {
  const query = buildQueryString({
    scope: params.scope,
    starts_after: params.startsAfter instanceof Date ? params.startsAfter.toISOString() : params.startsAfter,
    page: params.page,
    page_size: params.pageSize,
  });

  return requestApi<AppMatchListResponse>({ url: `/matches?${query}`, auth: true });
}

export function listMyMatches(params: { page: number; pageSize: number }) {
  return listMatches({ scope: "mine", page: params.page, pageSize: params.pageSize });
}

export function getMatchDetail(matchId: string) {
  return requestApi<AppMatchDetailResponse>({ url: `/matches/${matchId}`, auth: true });
}

export interface CreateMatchPayload {
  name: string;
  publication_mode: AppMatchSummary["publication_mode"];
  host_team_id: number;
  opponent_name?: string;
  players_per_team: number;
  host_capacity_limit?: number;
  start_time: string;
  end_time: string;
  location: string;
  location_latitude?: number;
  location_longitude?: number;
  description?: string;
}

export function createMatch(payload: CreateMatchPayload) {
  return requestApi<AppMatchDetailResponse>({
    url: "/matches",
    method: "POST",
    data: { ...payload },
    auth: true,
  });
}

export function putMyMatchRegistration(
  matchId: string,
  groupId: string,
  status: Extract<AppMatchRegistration["status"], "attending" | "leave" | "absent">,
) {
  return requestApi<AppMatchRegistration>({
    url: `/matches/${matchId}/groups/${groupId}/my-registration`,
    method: "PUT",
    data: { status, registration_count: 1 },
    auth: true,
  });
}

export function cancelMyMatchRegistration(matchId: string, groupId: string) {
  return requestApi<AppMatchRegistration>({
    url: `/matches/${matchId}/groups/${groupId}/my-registration`,
    method: "DELETE",
    auth: true,
  });
}
