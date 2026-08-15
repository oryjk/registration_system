import type {
  BackendTeam,
  BackendTeamAttendanceSummary,
  BackendTeamCreditOverview,
  BackendTeamCreditTransaction,
  BackendTeamDetail,
  BackendTeamLogoUploadResult,
  BackendTeamMember,
  BackendTeamMemberAttendance,
  BackendTeamPasswordInfo,
  BackendTeamSummary,
  BackendApiResponse,
} from "@/types/backend";
import type { AppTeamDetail, AppTeamMember, MyTeam } from "@/types/app";
import { getApiBaseUrl } from "@/config/apiBase";
import { getAccessToken } from "@/utils/authStorage";
import { buildQueryString } from "@/utils/queryString";
import { ApiRequestError, requestApi } from "@/utils/request";
import type { DateRangeParams } from "@/utils/dateRange";

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

export function joinTeam(payload: { team_id: number; password?: string }) {
  return requestApi<void>({
    url: "/teams/join",
    method: "POST",
    data: payload,
    auth: true,
  });
}

function teamStatusNumber(status: string | number): number {
  if (typeof status === "number") return status;
  return status === "active" ? 1 : 0;
}

function memberStatusNumber(status: string | number): number {
  if (typeof status === "number") return status;
  return status === "active" ? 1 : 0;
}

function toBackendTeam(team: MyTeam | AppTeamDetail | BackendTeam): BackendTeam {
  const item = team as MyTeam & Partial<BackendTeam>;
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    logo_url: item.logo_url ?? null,
    captain_id: item.captain_id ?? null,
    status: teamStatusNumber(item.status ?? 1),
    credit_score: item.credit_score ?? 0,
    vip_until: item.vip_until ?? null,
    trust_label: item.trust_label ?? "暂无评价",
    is_vip: item.is_vip ?? false,
    member_count: item.member_count,
    my_role: item.my_role ?? item.role,
    joined_at: item.joined_at,
  };
}

function toBackendMember(member: AppTeamMember): BackendTeamMember {
  return {
    user_id: member.user_id,
    role: member.role,
    jersey_number: null,
    is_member: member.status === "active",
    joined_at: member.joined_at,
    status: memberStatusNumber(member.status),
  };
}

export async function getMyTeams() {
  const teams = await requestApi<Array<MyTeam | BackendTeam>>({
    url: "/teams/my",
    auth: true,
  });
  return teams.map(toBackendTeam);
}

export async function getTeamDetail(teamId: number) {
  const detail = await requestApi<AppTeamDetail | BackendTeamDetail>({
    url: `/teams/${teamId}`,
    auth: true,
  });

  if ("team" in detail) {
    return detail;
  }

  const members = await requestApi<AppTeamMember[]>({
    url: `/teams/${teamId}/members`,
    auth: true,
  });
  return {
    team: toBackendTeam(detail),
    members: members.map(toBackendMember),
  } satisfies BackendTeamDetail;
}

export function getTeamPasswordInfo(teamId: number) {
  return requestApi<BackendTeamPasswordInfo>({
    url: `/teams/${teamId}/password-info`,
    auth: true,
  });
}

export function updateTeam(
  teamId: number,
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

export async function uploadTeamLogo(teamId: number, filePath: string) {
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

        if (parsed?.code !== 0 || !parsed.data) {
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
  teamId: number,
  payload: {
    user_id: number;
    role?: string;
    jersey_number?: string;
    is_member?: boolean;
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
  teamId: number,
  userId: number,
  payload: {
    role?: string;
    jersey_number?: string | null;
    is_member?: boolean;
  },
) {
  return requestApi<void>({
    url: `/teams/${teamId}/members/${userId}`,
    method: "PATCH",
    data: payload,
    auth: true,
  });
}

export function getTeamMemberAttendance(teamId: number, userId: number) {
  return requestApi<BackendTeamMemberAttendance>({
    url: `/teams/${teamId}/members/${userId}/attendance`,
    auth: true,
  });
}

export function getTeamAttendanceSummary(teamId: number, params?: DateRangeParams) {
  const queryString = buildQueryString({
    startDate: params?.startDate,
    endDate: params?.endDate,
  });

  return requestApi<BackendTeamAttendanceSummary>({
    url: `/teams/${teamId}/attendance-summary${queryString ? `?${queryString}` : ""}`,
    auth: true,
  });
}

export function removeTeamMember(teamId: number, userId: number) {
  return requestApi<void>({
    url: `/teams/${teamId}/members/${userId}`,
    method: "DELETE",
    auth: true,
  });
}

export function batchUpdateTeamMemberStatus(
  teamId: number,
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

export function getTeamCreditOverview(teamId: number) {
  return requestApi<BackendTeamCreditOverview>({
    url: `/teams/${teamId}/credit`,
    auth: true,
  });
}

export function getTeamCreditTransactions(teamId: number, limit = 20) {
  return requestApi<BackendTeamCreditTransaction[]>({
    url: `/teams/${teamId}/credit/transactions?limit=${limit}`,
    auth: true,
  });
}

export function submitTeamActivityReview(
  teamId: number,
  payload: {
    activity_id: string;
    reviewer_team_id: number;
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
  teamId: number,
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
