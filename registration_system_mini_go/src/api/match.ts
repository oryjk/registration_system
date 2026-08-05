import { request } from "@/api/http";
import type { HomeMatchesResponse } from "@/types/api";

export function getHomeMatches() {
  return request<HomeMatchesResponse>({
    path: "/matches/home",
    auth: true,
  });
}
