import { request } from "./client";
import type { TeamOption } from "../types/team";

export function listTeamOptions() {
  return request<TeamOption[]>("/teams");
}

export function createTeam(payload: { name: string; description?: string | null }) {
  return request<TeamOption>("/teams", { method: "POST", body: JSON.stringify(payload) });
}
