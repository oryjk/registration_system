import type {
  BackendTeam,
  BackendTeamAttendanceSummary,
  BackendTeamCreditOverview,
  BackendTeamCreditTransaction,
  BackendTeamDetail,
  BackendTeamMember,
  BackendTeamMemberAttendance,
  BackendTeamPasswordInfo,
  BackendTeamSummary,
  BackendApiResponse,
  BackendTeamMatchAttendance,
} from "@/types/backend";
import type { AppTeamDetail, AppTeamMember, MyTeam } from "@/types/app";
import { getApiBaseUrl } from "@/config/apiBase";
import { buildQueryString } from "@/utils/queryString";
import { requestApi } from "@/utils/request";
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
    // 队员管理页的头像/昵称依赖这两个字段，映射时不能丢弃。
    nickname: member.nickname,
    avatar_url: member.avatar_url,
    real_name: member.real_name,
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

/** 添加队员（Go app 侧接口，仅该队队长/领队可操作）。Go 模型只有 role/status，不支持球衣号等 legacy 字段。 */
export function addTeamMember(
  teamId: number,
  payload: {
    user_id: number;
    role?: string;
  },
) {
  return requestApi<void>({
    url: `/teams/${teamId}/members`,
    method: "POST",
    data: payload,
    auth: true,
  });
}

/** 修改队员角色或在队状态（Go app 侧接口，仅该队队长/领队可操作）。 */
export function updateTeamMember(
  teamId: number,
  userId: number,
  payload: {
    role?: string;
    status?: "active" | "inactive";
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

export function getTeamMatchAttendance(teamId: number, matchId: string) {
  return requestApi<BackendTeamMatchAttendance>({
    url: `/teams/${teamId}/matches/${matchId}/attendance`,
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

/** 批量冻结/恢复已合并进单人 updateTeamMember（Go app 侧无批量接口，legacy Rust 批量接口已废弃）。 */
export function setTeamMemberActive(teamId: number, userId: number, active: boolean) {
  return updateTeamMember(teamId, userId, { status: active ? "active" : "inactive" });
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

export interface AppTeamDetailData {
  id: number;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  captain_id?: number | null;
  status: string;
  my_role: string;
  credit_score: number;
  vip_until?: string | null;
  is_vip: boolean;
}

export function getAppTeamDetail(teamId: number) {
  return requestApi<AppTeamDetailData>({
    url: `/teams/${teamId}`,
    auth: true,
  });
}
