import { requestApi } from "@/utils/request";

export function claimVenueSide(matchId: string, teamId: number) {
  return requestApi<{ group_id: string; side: "a" | "b"; team_id: number }>({
    url: `/matches/${matchId}/venue-sides/claim`,
    method: "POST",
    data: { team_id: teamId },
    auth: true,
  });
}

export function withdrawVenueSide(matchId: string, groupId: string) {
  return requestApi<{ released: boolean }>({
    url: `/matches/${matchId}/venue-sides/${groupId}/withdraw`,
    method: "POST",
    auth: true,
  });
}

export function removeVenueSide(matchId: string, groupId: string) {
  return requestApi<{ released: boolean }>({
    url: `/matches/${matchId}/venue-sides/${groupId}/remove`,
    method: "POST",
    auth: true,
  });
}
