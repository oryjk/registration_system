import { request } from "./client";
import type {
  AddTeamMemberPayload,
  SaveTeamPayload,
  Team,
  TeamMemberCandidate,
  TeamMemberManagement,
  TeamStatus,
  UpdateTeamMemberPayload,
  UpdatePlayerProfilePayload,
  PlayerProfile,
} from "../types/team";

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

export function listTeamMembers(teamID: number) {
  return request<TeamMemberManagement>(`/teams/${teamID}/members`);
}

export function listTeamMemberCandidates(teamID: number, search = "") {
  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return request<TeamMemberCandidate[]>(`/teams/${teamID}/member-candidates${suffix}`);
}

export function addTeamMember(teamID: number, payload: AddTeamMemberPayload) {
  return request<TeamMemberManagement>(`/teams/${teamID}/members`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTeamMember(teamID: number, userID: number, payload: UpdateTeamMemberPayload) {
  return request<TeamMemberManagement>(`/teams/${teamID}/members/${userID}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updatePlayerProfile(userID: number, payload: UpdatePlayerProfilePayload) {
  return request<PlayerProfile>(`/users/${userID}/profile`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function removeTeamMember(teamID: number, userID: number) {
  return request<TeamMemberManagement>(`/teams/${teamID}/members/${userID}`, { method: "DELETE" });
}

export function setTeamCaptain(teamID: number, userID: number | null) {
  return request<TeamMemberManagement>(`/teams/${teamID}/captain`, {
    method: "PATCH",
    body: JSON.stringify({ user_id: userID }),
  });
}
