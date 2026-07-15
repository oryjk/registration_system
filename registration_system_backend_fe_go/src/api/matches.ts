import { request } from "./client";
import type {
  CreateMatchPayload,
  MatchDetail,
  MatchListPage,
  MatchListQuery,
  MatchStatus,
  UpdateMatchPayload,
} from "../types/match";

function buildQuery(query: MatchListQuery) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.page) params.set("page", String(query.page));
  if (query.page_size) params.set("page_size", String(query.page_size));
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function listMatches(query: MatchListQuery) {
  return request<MatchListPage>(`/matches${buildQuery(query)}`);
}

export function getMatch(id: string) {
  return request<MatchDetail>(`/matches/${id}`);
}

export function createMatch(payload: CreateMatchPayload) {
  return request<MatchDetail>("/matches", { method: "POST", body: JSON.stringify(payload) });
}

export function updateMatch(id: string, payload: UpdateMatchPayload) {
  return request<MatchDetail>(`/matches/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function updateMatchStatus(id: string, status: MatchStatus) {
  return request<MatchDetail>(`/matches/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}
