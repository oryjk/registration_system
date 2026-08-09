import type { AppMatchDetailResponse, AppMatchHomeResponse, AppMatchListResponse, AppMatchRegistration } from "@/types/match";
import { buildQueryString } from "@/utils/queryString";
import { requestApi } from "@/utils/request";

export function getMatchHome() {
  return requestApi<AppMatchHomeResponse>({ url: "/matches/home", auth: true });
}

export function listMyMatches(params: { page: number; pageSize: number }) {
  const query = buildQueryString({
    scope: "mine",
    page: params.page,
    page_size: params.pageSize,
  });

  return requestApi<AppMatchListResponse>({ url: `/matches?${query}`, auth: true });
}

export function getMatchDetail(matchId: string) {
  return requestApi<AppMatchDetailResponse>({ url: `/matches/${matchId}`, auth: true });
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
