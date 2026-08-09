import type { AppMatchDetailResponse, AppMatchHomeResponse, AppMatchListResponse } from "@/types/match";
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
