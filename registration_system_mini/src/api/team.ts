import type {
  BackendTeam,
  BackendTeamCreditOverview,
  BackendTeamCreditTransaction,
  BackendTeamDetail,
  BackendTeamLogoUploadResult,
  BackendTeamPasswordInfo,
  BackendTeamSummary,
  BackendApiResponse,
} from "@/types/backend";
import { getApiBaseUrl } from "@/config/apiBase";
import { getAccessToken } from "@/utils/authStorage";
import { buildQueryString } from "@/utils/queryString";
import { ApiRequestError, requestApi } from "@/utils/request";

export function createTeam(payload: {
  name: string;
  description?: string;
  logo_url?: string;
  join_password?: string;
}) {
  return requestApi<BackendTeam>({
    url: "/teams",
    method: "POST",
    data: payload,
    auth: true,
  });
}

export function searchTeams(keyword: string) {
  const queryString = buildQueryString({ keyword });
  return requestApi<BackendTeamSummary[]>({
    url: `/teams/search${queryString ? `?${queryString}` : ""}`,
    auth: true,
  });
}

export function joinTeam(payload: { team_id: string; password?: string }) {
  return requestApi<void>({
    url: "/teams/join",
    method: "POST",
    data: payload,
    auth: true,
  });
}

export function getMyTeams() {
  return requestApi<BackendTeam[]>({
    url: "/teams/my-teams",
    auth: true,
  });
}

export function getTeamDetail(teamId: string) {
  return requestApi<BackendTeamDetail>({
    url: `/teams/${teamId}`,
    auth: true,
  });
}

export function getTeamPasswordInfo(teamId: string) {
  return requestApi<BackendTeamPasswordInfo>({
    url: `/teams/${teamId}/password-info`,
    auth: true,
  });
}

export function updateTeam(
  teamId: string,
  payload: {
    name?: string;
    description?: string | null;
    logo_url?: string | null;
    join_password?: string | null;
  },
) {
  return requestApi<void>({
    url: `/teams/${teamId}`,
    method: "PATCH",
    data: payload,
    auth: true,
  });
}

export async function uploadTeamLogo(teamId: string, filePath: string) {
  const token = getAccessToken();

  return new Promise<BackendTeamLogoUploadResult>((resolve, reject) => {
    uni.uploadFile({
      url: `${getApiBaseUrl()}/teams/${teamId}/logo`,
      filePath,
      name: "file",
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (response) => {
        let parsed: BackendApiResponse<BackendTeamLogoUploadResult> | null = null;
        try {
          parsed = JSON.parse(response.data) as BackendApiResponse<BackendTeamLogoUploadResult>;
        } catch (_error) {
          reject(new ApiRequestError("球队 Logo 上传响应解析失败"));
          return;
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new ApiRequestError(parsed?.message || "球队 Logo 上传失败", response.statusCode));
          return;
        }

        if (!parsed?.success || !parsed.data) {
          reject(new ApiRequestError(parsed?.message || "球队 Logo 上传失败", response.statusCode));
          return;
        }

        resolve(parsed.data);
      },
      fail: (error) => {
        reject(new ApiRequestError(error.errMsg || "球队 Logo 上传失败"));
      },
    });
  });
}

export function addTeamMember(
  teamId: string,
  payload: {
    user_id: number;
    role?: string;
    jersey_number?: string;
  },
) {
  return requestApi<void>({
    url: `/teams/${teamId}/members`,
    method: "POST",
    data: payload,
    auth: true,
  });
}

export function updateTeamMember(
  teamId: string,
  userId: number,
  payload: {
    role?: string;
    jersey_number?: string | null;
  },
) {
  return requestApi<void>({
    url: `/teams/${teamId}/members/${userId}`,
    method: "PATCH",
    data: payload,
    auth: true,
  });
}

export function removeTeamMember(teamId: string, userId: number) {
  return requestApi<void>({
    url: `/teams/${teamId}/members/${userId}`,
    method: "DELETE",
    auth: true,
  });
}

export function batchUpdateTeamMemberStatus(
  teamId: string,
  payload: {
    user_ids: number[];
    status: number;
  },
) {
  return requestApi<number>({
    url: `/teams/${teamId}/members/batch`,
    method: "PATCH",
    data: payload,
    auth: true,
  });
}

export function getTeamCreditOverview(teamId: string) {
  return requestApi<BackendTeamCreditOverview>({
    url: `/teams/${teamId}/credit`,
    auth: true,
  });
}

export function getTeamCreditTransactions(teamId: string, limit = 20) {
  return requestApi<BackendTeamCreditTransaction[]>({
    url: `/teams/${teamId}/credit/transactions?limit=${limit}`,
    auth: true,
  });
}

export function submitTeamActivityReview(
  teamId: string,
  payload: {
    activity_id: string;
    reviewer_team_id: string;
    rating: number;
    comment?: string;
  },
) {
  return requestApi<BackendTeamCreditOverview>({
    url: `/teams/${teamId}/credit/reviews`,
    method: "POST",
    data: payload,
    auth: true,
  });
}

export function rechargeTeamMembership(
  teamId: string,
  payload: {
    months: number;
    note?: string;
  },
) {
  return requestApi<BackendTeamCreditOverview>({
    url: `/teams/${teamId}/credit/membership-recharges`,
    method: "POST",
    data: payload,
    auth: true,
  });
}
