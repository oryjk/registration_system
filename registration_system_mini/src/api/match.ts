import type {
  BackendMatchSettleResult,
  BackendMatchSettlementSummary,
} from "@/types/backend";
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
  /** 只保留 end_time 晚于该时刻且未取消的比赛（「未结束」过滤）。 */
  endsAfter?: Date | string;
  /** 只保留有主队的比赛（散人约球无主队，无法联系队长）。 */
  hostTeamOnly?: boolean;
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
    ends_after: toIsoOrPass(params.endsAfter),
    host_team_only: params.hostTeamOnly ? true : undefined,
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

/** 主队管理者编辑比赛：对手名称（空串=清除）、主队报名组人数上限、起止时间与比赛类型；均可选，不传不改。 */
export function updateMyMatch(matchId: string, payload: { opponent_name?: string; max_players?: number; start_time?: string; end_time?: string; publication_mode?: AppMatchSummary["publication_mode"] }) {
  return requestApi<AppMatchDetailResponse>({
    url: `/matches/${matchId}`,
    method: "PATCH",
    data: payload,
    auth: true,
  });
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

/** 比赛管理员录入/修正比赛比分：进行中与已结束均可，重复提交覆盖旧比分。 */
export function updateMatchScore(matchId: string, payload: { host_score: number; away_score: number }) {
  return requestApi<AppMatchDetailResponse>({
    url: `/matches/${matchId}/score`,
    method: "PATCH",
    data: payload,
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
  registrationCount = 1,
) {
  return requestApi<AppMatchRegistration>({
    url: `/matches/${matchId}/groups/${groupId}/my-registration`,
    method: "PUT",
    data: { status, registration_count: registrationCount },
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

/** 比赛结算摘要；未结算时 items 为可扣名单并预填人均费，需结算管理权限。 */
export function getMatchSettlement(matchId: string) {
  return requestApi<BackendMatchSettlementSummary>({
    url: `/matches/${matchId}/settlement`,
    auth: true,
  });
}

/** 提交比赛结算（已有生效批次时冲正重算）；items 须与可扣名单完全一致。 */
export function settleMatch(
  matchId: string,
  payload: { items: Array<{ user_id: number; amount_cents: number }>; description?: string },
) {
  return requestApi<BackendMatchSettleResult>({
    url: `/matches/${matchId}/settlement`,
    method: "POST",
    data: payload,
    auth: true,
  });
}

export interface BackendVenueSuggestion {
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  use_count: number;
  last_used_at: string;
}

/** 发布页常用场地建议（历史比赛场地聚合）；减少地图选点 API 消耗。 */
export function getVenueSuggestions(limit = 10) {
  return requestApi<BackendVenueSuggestion[]>({
    url: `/venues/suggestions?limit=${limit}`,
    auth: true,
  });
}
