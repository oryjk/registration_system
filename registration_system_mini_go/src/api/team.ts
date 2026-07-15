import { request } from "@/api/http";
import type { TeamMembership } from "@/types/api";

export function getMyTeams() {
  return request<TeamMembership[]>({
    path: "/teams/my",
    auth: true,
  });
}
