import type {
  AppMatchDetailResponse,
  AppMatchHomeResponse,
  AppMatchListResponse,
  AppMatchListScope,
  AppMatchPaymentMode,
  AppMatchPublicationMode,
  AppMatchRegistration,
  AppMatchStatus,
  AppMatchSummary,
} from "@/types/match";
import { buildQueryString } from "@/utils/queryString";
import { requestApi } from "@/utils/request";

export function getMatchHome() {
  return requestApi<AppMatchHomeResponse>({ url: "/matches/home", auth: true });
}

export interface ListMatchesParams {
  scope: AppMatchListScope;
  status?: AppMatchStatus;
  search?: string;
  startsAfter?: Date | string;
  dateStart?: Date | string;
  publicationModes?: AppMatchPublicationMode[];
  page: number;
  pageSize: number;
}

export function listMatches(params: ListMatchesParams) {
  const query = buildQueryString({
    scope: params.scope,
    status: params.status,
    search: params.search?.trim() || undefined,
    // 后端 timestamp 列存 UTC 时刻，时间过滤参数统一传 UTC（toISOString）挂钟。
    starts_after: toIsoOrPass(params.startsAfter),
    date_start: toIsoOrPass(params.dateStart),
    publication_modes: params.publicationModes?.length ? params.publicationModes.join(",") : undefined,
    page: params.page,
    page_size: params.pageSize,
  });

  return requestApi<AppMatchListResponse>({ url: `/matches?${query}`, auth: true });
}

function toIsoOrPass(value: Date | string | undefined): string | undefined {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value || undefined;
}

export function listMyMatches(params: { page: number; pageSize: number; search?: string }) {
  return listMatches({ scope: "mine", page: params.page, pageSize: params.pageSize, search: params.search });
}

export function getMatchDetail(matchId: string) {
  return requestApi<AppMatchDetailResponse>({ url: `/matches/${matchId}`, auth: true });
}

/** 主队管理方在比赛过结束时间后收尾：标记已结束或已取消。 */
export function updateMatchStatus(matchId: string, status: Extract<AppMatchStatus, "ended" | "cancelled">) {
  return requestApi<AppMatchDetailResponse>({
    url: `/matches/${matchId}/status`,
    method: "PATCH",
    data: { status },
    auth: true,
  });
}

export interface CreateMatchPayload {
  name: string;
  publication_mode: AppMatchSummary["publication_mode"];
  /** 散人约球（online_pickup）不传；其余模式必填。 */
  host_team_id?: number;
  opponent_name?: string;
  players_per_team: number;
  host_capacity_limit?: number;
  start_time: string;
  end_time: string;
  registration_start_at?: string;
  registration_end_at?: string;
  location: string;
  location_latitude?: number;
  location_longitude?: number;
  description?: string;
  /** 不传默认免费；创建页按人均费用推导。 */
  is_free?: boolean;
  /** 报名费支付节奏；prepaid 必须同时给出费用。 */
  payment_mode?: AppMatchPaymentMode;
  /** 人均报名费（分）。 */
  fee_per_person_cents?: number;
  host_color?: string;
  away_color?: string;
}

export function createMatch(payload: CreateMatchPayload) {
  return requestApi<AppMatchDetailResponse>({
    url: "/matches",
    method: "POST",
    data: { ...payload },
    auth: true,
  });
}

export function putMyMatchRegistration(
  matchId: string,
  groupId: string,
  status: Extract<AppMatchRegistration["status"], "attending" | "leave" | "absent">,
) {
  return requestApi<AppMatchRegistration>({
    url: `/matches/${matchId}/groups/${groupId}/my-registration`,
    method: "PUT",
    data: { status, registration_count: 1 },
    auth: true,
  });
}

export function cancelMyMatchRegistration(matchId: string, groupId: string) {
  return requestApi<AppMatchRegistration>({
    url: `/matches/${matchId}/groups/${groupId}/my-registration`,
    method: "DELETE",
    auth: true,
  });
}
