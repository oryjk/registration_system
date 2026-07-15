import { request } from "./client";
import type { SaveTeamPayload, Team, TeamStatus } from "../types/team";

export function listTeamOptions() {
  return request<Team[]>("/teams?status=active");
}

export function listTeams(status?: TeamStatus) {
  const query = status ? `?status=${status}` : "";
  return request<Team[]>(`/teams${query}`);
}

export function getTeam(id: number) {
  return request<Team>(`/teams/${id}`);
}

export function createTeam(payload: SaveTeamPayload) {
  return request<Team>("/teams", { method: "POST", body: JSON.stringify(payload) });
}

export function updateTeam(id: number, payload: Required<SaveTeamPayload>) {
  return request<Team>(`/teams/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteTeam(id: number) {
  return request<{ id: number }>(`/teams/${id}`, { method: "DELETE" });
}
