import type { AppTeamApplication } from "@/types/match";
import { requestApi } from "@/utils/request";

export function listTeamApplications(matchId: string) {
  return requestApi<AppTeamApplication[]>({
    url: `/matches/${matchId}/team-applications`,
    auth: true,
  });
}

export function applyTeamMatch(matchId: string, teamId: number, introduction: string) {
  return requestApi<AppTeamApplication>({
    url: `/matches/${matchId}/team-applications`,
    method: "POST",
    data: {
      team_id: teamId,
      introduction,
    },
    auth: true,
  });
}

export function withdrawTeamApplication(matchId: string, applicationId: string) {
  return requestApi<AppTeamApplication>({
    url: `/matches/${matchId}/team-applications/${applicationId}/withdraw`,
    method: "POST",
    auth: true,
  });
}

export function selectTeamApplication(matchId: string, applicationId: string) {
  return requestApi<AppTeamApplication>({
    url: `/matches/${matchId}/team-applications/${applicationId}/select`,
    method: "POST",
    auth: true,
  });
}
