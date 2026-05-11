import type { BackendChallenge, BackendChallengeDetail, BackendChallengeSummary } from "@/types/backend";
import { buildQueryString } from "@/utils/queryString";
import { requestApi } from "@/utils/request";

export function listChallenges(params: {
  teamId?: string;
  keyword?: string;
  status?: "open" | "matched" | "cancelled";
  includeClosed?: boolean;
  limit?: number;
  sort?: "holding_date_asc" | "holding_date_desc" | "created_at_desc" | "credit_desc";
  auth?: boolean;
}) {
  const queryString = buildQueryString({
    team_id: params.teamId,
    keyword: params.keyword?.trim() || undefined,
    status: params.status,
    include_closed: params.includeClosed ? true : undefined,
    limit: params.limit,
    sort: params.sort,
  });

  return requestApi<BackendChallengeSummary[]>({
    url: `/challenges?${queryString}`,
    auth: params.auth ?? !!params.teamId,
  });
}

export function getChallengeDetail(challengeId: string) {
  return requestApi<BackendChallengeDetail>({
    url: `/challenges/${challengeId}`,
    auth: true,
  });
}

export function createChallenge(payload: {
  kind: "team" | "individual";
  host_team_id: string;
  title: string;
  holding_date: string;
  start_time: string;
  end_time: string;
  location: string;
  location_latitude?: number;
  location_longitude?: number;
  players_per_team: number;
  fee_per_person?: string;
  note?: string;
}) {
  return requestApi<BackendChallenge>({
    url: "/challenges",
    method: "POST",
    data: payload,
    auth: true,
  });
}

export function acceptChallenge(challengeId: string, guestTeamId?: string) {
  return requestApi<BackendChallenge>({
    url: `/challenges/${challengeId}/accept`,
    method: "POST",
    data: {
      guest_team_id: guestTeamId,
    },
    auth: true,
  });
}

export function cancelChallenge(challengeId: string) {
  return requestApi<BackendChallenge>({
    url: `/challenges/${challengeId}/cancel`,
    method: "POST",
    auth: true,
  });
}
