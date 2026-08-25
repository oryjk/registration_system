import type { BackendApiResponse } from "@/types/backend";
import { MOCK_PAY_SIGN } from "@/utils/payment";
import { findMockUser, mockCurrentUser, mockUsers, mockMyActivities } from "./data/users";
import { mockTeams, findMockTeam, TEAM_ID_HEXI, TEAM_ID_MINGYUE } from "./data/teams";
import {
  getMockActivity,
  getMockActivityUsers,
  buildMockActivityListPage,
  checkMockOngoingActivity,
} from "./data/activities";
import {
  filterMockChallengeSummaries,
  getMockChallengeDetail,
} from "./data/challenges";
import { createMockMatch, filterMockMatchesByQuery, getMockMatchDetail, markMockMyRegistrationPaid, mockMatchHome, mockMyRegistrationCount, paginateMockMatches, updateMockMatchStatus, upsertMockMyRegistration } from "./data/matches";
import { mockNotifications } from "./data/notifications";
import { mockPaymentOrders, mockTeamFundBalances, mockTeamFundTransactions } from "./data/billing";
import { mockWalletAccount } from "./data/wallet";
import { defaultMiniAppRuntimeConfig } from "@/config/runtimeConfigDefaults";
import { resolveRegistrationWindow } from "@/utils/registrationWindow";

/**
 * Mock 请求处理器。
 *
 * 每个 handler 接收解析后的路径段、查询参数和请求体，返回 data 部分（不含 envelope）。
 * 返回 undefined 表示该 handler 不匹配（用于动态路径判断），交由兜底处理。
 */

export type HttpMethod = string;

export interface ParsedRequest {
  /** 去除 query string 后的路径，不含 baseURL 前缀（如 "/activity/infos"） */
  path: string;
  /** 路径按 "/" 分割后的段 */
  segments: string[];
  /** 从路径模式 :param 提取的参数（如 { id: "101" }） */
  params: Record<string, string>;
  /** 解析后的 query 参数 */
  query: Record<string, string>;
  /** 请求体（POST/PATCH/PUT） */
  body: unknown;
}

type MockHandler = (req: ParsedRequest) => unknown | undefined;

interface MockRoute {
  method: HttpMethod;
  /** 路径模式，支持 ":param" 占位符，如 "/teams/:id" */
  pattern: string;
  handler: MockHandler;
}

const mockTeamAttendanceActivityIds = ["act-001", "act-003", "act-005"];
let mockAuthenticatedUserId = mockCurrentUser.id;
// 报名费订单号 → 比赛 ID：sync 核销时把对应 mock 报名标记为已支付。
const mockPaymentOrderMatchIds = new Map<string, string>();


// 约队申请 mock：仅内存态，刷新后重置，供 H5 mock 演示接约流程。
const mockTeamApplications = new Map<string, Array<{
  id: string;
  match_id: string;
  applicant_team_id: number;
  applicant_team_name: string;
  introduction: string;
  status: string;
  created_by_user_id: number;
  selected_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
}>>();

function mockTeamApplicationsFor(matchId: string) {
  return mockTeamApplications.get(matchId) ?? [];
}

function ensureMockRegistrationOpen(matchId: string) {
  const now = Date.now();
  const match = getMockMatchDetail(matchId, now)?.match;
  if (!match) return;
  const window = resolveRegistrationWindow({
    now,
    isRegistering: match.status === "registering",
    registrationStartAt: match.registration_start_at,
    registrationEndAt: match.registration_end_at,
  });
  if (window.state !== "open") {
    throw new Error("当前不在报名时间内");
  }
}

function createMockTeamApplication(matchId: string, body: { team_id?: number; introduction?: string }) {
  const applications = mockTeamApplications.get(matchId) ?? [];
  if (!body?.team_id || !body.introduction?.trim()) {
    throw new Error("球队申请信息不完整");
  }
  if (applications.some((item) => item.status === "pending" || item.status === "selected")) {
    throw new Error("该球队已经提交过有效申请");
  }
  const now = new Date().toISOString();
  const created = {
    id: `mock-application-${matchId}-${applications.length + 1}`,
    match_id: matchId,
    applicant_team_id: body.team_id,
    applicant_team_name: "",
    introduction: body.introduction.trim(),
    status: "pending",
    created_by_user_id: currentMockUser().id,
    selected_at: null,
    withdrawn_at: null,
    created_at: now,
    updated_at: now,
  };
  mockTeamApplications.set(matchId, [...applications, created]);
  return created;
}

function selectMockTeamApplication(matchId: string, applicationId: string) {
  const applications = mockTeamApplications.get(matchId) ?? [];
  const target = applications.find((item) => item.id === applicationId);
  if (!target) {
    throw new Error("球队申请不存在");
  }
  const now = new Date().toISOString();
  for (const item of applications) {
    if (item.status === "pending") {
      item.status = item.id === applicationId ? "selected" : "rejected";
      item.updated_at = now;
      if (item.id === applicationId) {
        item.selected_at = now;
      }
    }
  }
  mockTeamApplications.set(matchId, applications);
  return target;
}

function withdrawMockTeamApplication(matchId: string, applicationId: string) {
  const applications = mockTeamApplications.get(matchId) ?? [];
  const target = applications.find((item) => item.id === applicationId);
  if (!target) {
    throw new Error("球队申请不存在");
  }
  if (target.status === "pending") {
    ensureMockRegistrationOpen(matchId);
  }
  target.status = "withdrawn";
  target.withdrawn_at = new Date().toISOString();
  mockTeamApplications.set(matchId, applications);
  return target;
}

function currentMockUser() {
  return findMockUser(mockAuthenticatedUserId) ?? mockCurrentUser;
}

function buildMockMyTeams(userId: number) {
  return mockTeams.flatMap((team) => {
    const member = findMockTeam(team.id)?.members.find((item) => item.user_id === userId);
    return member ? [{ ...team, my_role: member.role, joined_at: member.joined_at }] : [];
  });
}

function buildMockTeamAttendanceRecords(teamId: number, userId: number) {
  const supportedTeamIds = [TEAM_ID_MINGYUE, TEAM_ID_HEXI];
  const team = findMockTeam(teamId);
  if (!supportedTeamIds.includes(teamId) || !team?.members.some((member) => member.user_id === userId)) {
    return [];
  }

  return mockTeamAttendanceActivityIds.flatMap((activityId, activityIndex) => {
    const activity = getMockActivity(activityId);
    if (!activity) return [];

    const statusSeed = (userId + activityIndex) % 5;
    const stand = statusSeed === 0 ? 2 : statusSeed === 1 ? 3 : statusSeed === 2 ? 0 : 1;
    return [{
      activity_id: activity.id,
      activity_name: activity.name,
      holding_date: activity.holding_date,
      location: activity.location,
      stand,
      registration_count: stand === 1 ? 1 : 0,
      operation_time: activity.holding_date,
      registered: stand !== 0,
    }];
  });
}

function buildEnvelope<T>(data: T): BackendApiResponse<T> {
  return { code: 0, message: "ok", data };
}

/** 所有注册的 mock 路由 */
const routes: MockRoute[] = [
  // ===== 认证 / 用户 =====
  {
    method: "POST",
    pattern: "/auth/wechat/login",
    handler: () => {
      mockAuthenticatedUserId = mockCurrentUser.id;
      return { token: "mock-token-wangrui", user: mockCurrentUser };
    },
  },
  {
    method: "GET",
    pattern: "/test-auth/users",
    handler: () => ({
      items: mockUsers.slice(0, 6).map((user) => ({
        id: user.id,
        display_name: user.real_name || user.nickname || `用户 #${user.id}`,
        avatar_url: user.avatar_url || null,
        teams: buildMockMyTeams(user.id).map((team) => ({ id: team.id, name: team.name, role: team.my_role ?? "member" })),
      })),
      default_user_id: mockCurrentUser.id,
    }),
  },
  {
    method: "POST",
    pattern: "/test-auth/login",
    handler: (req) => {
      const userId = Number((req.body as { user_id?: number } | undefined)?.user_id);
      const user = findMockUser(userId);
      if (!user) return undefined;
      mockAuthenticatedUserId = user.id;
      return { token: `mock-token-${user.id}`, user };
    },
  },
  {
    method: "POST",
    pattern: "/wx/login",
    handler: () => ({ openid: "mock-openid-wangrui", session_key: null, unionid: null }),
  },
  {
    method: "POST",
    pattern: "/user/login",
    handler: () => ({
      access_token: "mock-token-wangrui",
      token_type: "bearer",
      user: mockCurrentUser,
    }),
  },
  {
    method: "GET",
    pattern: "/user/info",
    handler: () => mockCurrentUser,
  },
  {
    method: "GET",
    pattern: "/users/me",
    handler: () => currentMockUser(),
  },
  {
    method: "PATCH",
    pattern: "/user/info",
    handler: (req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      return { ...mockCurrentUser, ...body };
    },
  },
  {
    method: "PATCH",
    pattern: "/users/me",
    handler: (req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      return { ...mockCurrentUser, ...body };
    },
  },
  {
    method: "GET",
    pattern: "/user/infos",
    handler: () => mockUsers,
  },
  {
    method: "GET",
    pattern: "/user/activities",
    handler: () => mockMyActivities,
  },
  {
    method: "GET",
    pattern: "/user/attendance",
    handler: () => [],
  },
  {
    method: "GET",
    pattern: "/user/attendance-ranking",
    handler: () => [],
  },
  {
    method: "GET",
    pattern: "/user/search",
    handler: (req) => {
      const keyword = req.query.keyword ?? "";
      if (!keyword) return mockUsers.slice(0, 8);
      return mockUsers.filter(
        (user) => user.nickname.includes(keyword) || user.real_name.includes(keyword),
      );
    },
  },

  // ===== 球队 =====
  {
    method: "GET",
    pattern: "/teams/my-teams",
    handler: () => mockTeams,
  },
  {
    method: "GET",
    pattern: "/teams/my",
    handler: () => buildMockMyTeams(mockAuthenticatedUserId),
  },
  {
    method: "POST",
    pattern: "/payments/team-membership-orders",
    handler: (req) => {
      const payload = req.body as { team_id?: number; amount_cents?: number } | undefined;
      const amountCents = Math.max(1, Math.min(1_000_000, Math.round(Number(payload?.amount_cents ?? 0))));
      return {
        order: {
          order_no: `PM${Date.now()}`,
          kind: "team_membership",
          amount_cents: amountCents,
          status: "pending",
        },
        payment: {
          timeStamp: String(Math.floor(Date.now() / 1000)),
          nonceStr: "mocknonce",
          package: "prepay_id=mock_team_fee",
          signType: "MD5",
          paySign: MOCK_PAY_SIGN,
        },
      };
    },
  },
  {
    method: "POST",
    pattern: "/payments/match-registration-orders",
    handler: (req) => {
      const payload = req.body as { match_id?: string } | undefined;
      // mock 不校验报名状态；金额 = 比赛人均定价 × 当前报名人数（详情缺失时兜底单人价）。
      const matchId = payload?.match_id ?? "";
      const detail = getMockMatchDetail(matchId);
      const perPersonCents = detail?.match.fee_per_person_cents ?? 2500;
      const amountCents = perPersonCents * mockMyRegistrationCount(matchId);
      const orderNo = `PR${Date.now()}`;
      mockPaymentOrderMatchIds.set(orderNo, matchId);
      return {
        order: {
          order_no: orderNo,
          kind: "match_registration",
          match_id: matchId || null,
          amount_cents: amountCents,
          status: "pending",
        },
        payment: {
          timeStamp: String(Math.floor(Date.now() / 1000)),
          nonceStr: "mocknonce",
          package: "prepay_id=mock_match_fee",
          signType: "MD5",
          paySign: MOCK_PAY_SIGN,
        },
      };
    },
  },
  {
    method: "POST",
    pattern: "/payments/orders/:orderNo/sync",
    handler: (req) => {
      if (req.params.orderNo.startsWith("PR")) {
        const matchId = mockPaymentOrderMatchIds.get(req.params.orderNo);
        if (matchId) markMockMyRegistrationPaid(matchId);
      }
      return {
        order: { order_no: req.params.orderNo, status: "paid" },
      };
    },
  },
  {
    method: "GET",
    pattern: "/teams/:id",
    handler: (req) => {
      const teamId = Number(req.params.id);
      const detail = findMockTeam(teamId);
      if (!detail) return undefined;
      // 补齐 Go AppTeamDetail 字段,球队二级页(队费充值)可直接使用。
      const me = detail.members.find((item) => item.user_id === mockAuthenticatedUserId);
      return {
        ...detail,
        status: "active",
        my_role: me?.role ?? "member",
        credit_score: 90,
        vip_until: null,
        is_vip: false,
        my_balance_cents: 0,
      };
    },
  },
  {
    method: "GET",
    pattern: "/teams/:id/members",
    // 与真实接口对齐：返回 AppTeamMember 形状（带昵称/头像），供队员管理页展示。
    handler: (req) => {
      const detail = findMockTeam(Number(req.params.id));
      if (!detail) return undefined;
      return detail.members.map((member) => {
        const user = mockUsers.find((item) => item.id === member.user_id);
        return {
          user_id: member.user_id,
          nickname: user?.nickname || `用户 ${member.user_id}`,
          avatar_url: user?.avatar_url ?? null,
          real_name: user?.real_name ?? null,
          role: member.role,
          status: member.status === 1 ? "active" : "inactive",
          joined_at: member.joined_at,
        };
      });
    },
  },
  {
    method: "GET",
    pattern: "/teams/:id/password-info",
    handler: () => ({ team_id: 0, requires_password: false }),
  },
  {
    method: "GET",
    pattern: "/teams/search",
    handler: (req) => {
      const keyword = req.query.keyword ?? "";
      if (!keyword) return [];
      return mockTeams.filter((team) => team.name.includes(keyword));
    },
  },
  {
    method: "GET",
    pattern: "/teams/:id/attendance-summary",
    handler: (req) => ({
      my_records: buildMockTeamAttendanceRecords(Number(req.params.id), mockCurrentUser.id),
      ranking: [],
    }),
  },
  {
    method: "GET",
    pattern: "/teams/:id/members/:userId/attendance",
    handler: (req) => ({
      records: buildMockTeamAttendanceRecords(Number(req.params.id), Number(req.params.userId)),
    }),
  },
  {
    method: "GET",
    pattern: "/teams/:id/matches/:matchId/attendance",
    handler: (req) => {
      const teamId = Number(req.params.id);
      const matchId = req.params.matchId;
      const team = findMockTeam(teamId);
      const activity = getMockActivity(matchId);
      if (!team || !activity || !mockTeamAttendanceActivityIds.includes(matchId)) return undefined;
      const activityIndex = mockTeamAttendanceActivityIds.indexOf(matchId);
      const records = team.members
        .filter((member) => member.status === 1)
        .map((member) => {
          const statusSeed = (member.user_id + activityIndex) % 5;
          const stand = statusSeed === 0 ? 2 : statusSeed === 1 ? 3 : statusSeed === 2 ? 0 : 1;
          return {
            user_id: member.user_id,
            nickname: member.nickname,
            avatar_url: member.avatar_url ?? null,
            stand,
            registration_count: stand === 1 ? 1 : 0,
            operation_time: activity.holding_date,
            registered: stand !== 0,
          };
        });
      return {
        match: {
          activity_id: activity.id,
          activity_name: activity.name,
          holding_date: activity.holding_date,
          location: activity.location,
        },
        records,
      };
    },
  },
  {
    method: "GET",
    pattern: "/teams/:id/credit",
    handler: (req) => {
      const teamId = Number(req.params.id);
      const team = mockTeams.find((item) => item.id === teamId);
      if (!team) return undefined;
      return { team, trust_label: team.trust_label, is_vip: team.is_vip };
    },
  },
  {
    method: "GET",
    pattern: "/teams/:id/credit/transactions",
    handler: () => [],
  },

  // ===== 活动 / 比赛 =====
  {
    method: "GET",
    pattern: "/activity/infos",
    handler: (req) =>
      buildMockActivityListPage({
        page: req.query.page ? Number(req.query.page) : undefined,
        pageSize: req.query.page_size ? Number(req.query.page_size) : undefined,
        teamId: req.query.team_id ? Number(req.query.team_id) : undefined,
        holdingAfter: req.query.holding_after,
      }),
  },
  {
    method: "GET",
    pattern: "/activity/check-ongoing",
    handler: () => checkMockOngoingActivity(),
  },
  {
    method: "GET",
    pattern: "/activity/:id/users",
    handler: (req) => getMockActivityUsers(req.params.id),
  },
  {
    method: "GET",
    pattern: "/activity/:id",
    handler: (req) => getMockActivity(req.params.id) ?? undefined,
  },
  {
    method: "GET",
    pattern: "/activity/location-search",
    handler: () => [],
  },
  {
    method: "GET",
    pattern: "/activity/location-resolve",
    handler: () => ({
      provider_place_id: "mock",
      title: "模拟地点",
      address: "模拟地址",
      display_name: "模拟地点",
      latitude: "30.6428",
      longitude: "104.0668",
    }),
  },
  {
    method: "PATCH",
    pattern: "/activity/:id/my-stand",
    handler: () => null,
  },
  {
    method: "POST",
    pattern: "/activity/:id/team-registration",
    handler: (req) => getMockActivity(req.params.id) ?? undefined,
  },
  {
    method: "DELETE",
    pattern: "/activity/:id/team-registration",
    handler: () => null,
  },
  {
    method: "PATCH",
    pattern: "/activity/:id/check-in-config",
    handler: (req) => getMockActivity(req.params.id) ?? undefined,
  },
  {
    method: "POST",
    pattern: "/activity/:id/check-in",
    handler: (req) => ({
      activity_id: req.params.id,
      team_id: TEAM_ID_MINGYUE,
      user_id: mockCurrentUser.id,
      distance_meters: 50,
      checked_in_at: new Date().toISOString(),
    }),
  },

  // ===== 约队 =====
  {
    method: "GET",
    pattern: "/challenges",
    handler: (req) =>
      filterMockChallengeSummaries({
        status: req.query.status,
        startsAfter: req.query.starts_after,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      }),
  },
  {
    method: "GET",
    pattern: "/challenges/:id",
    handler: (req) => getMockChallengeDetail(req.params.id) ?? undefined,
  },

  // ===== 比赛 =====
  {
    method: "GET",
    pattern: "/matches/home",
    handler: () => mockMatchHome(),
  },
  {
    method: "POST",
    pattern: "/matches",
    handler: (req) => createMockMatch(req.body as Parameters<typeof createMockMatch>[0]),
  },
  {
    method: "GET",
    pattern: "/matches",
    handler: (req) => paginateMockMatches(filterMockMatchesByQuery(req.query), req.query),
  },
  {
    method: "GET",
    pattern: "/matches/:id",
    handler: (req) => getMockMatchDetail(req.params.id) ?? undefined,
  },
  {
    method: "PATCH",
    pattern: "/matches/:id/status",
    handler: (req) => {
      const payload = req.body as { status?: string } | undefined;
      if (payload?.status !== "ended" && payload?.status !== "cancelled") {
        throw new Error("收尾状态只能是已结束或已取消");
      }
      return updateMockMatchStatus(req.params.id, payload.status) ?? undefined;
    },
  },
  {
    method: "PUT",
    pattern: "/matches/:id/groups/:groupId/my-registration",
    handler: (req) => {
      ensureMockRegistrationOpen(req.params.id);
      const payload = req.body as { status?: string; registration_count?: number } | undefined;
      const status = payload?.status ?? "unknown";
      const count = Number.isFinite(payload?.registration_count) ? Number(payload?.registration_count) : 1;
      upsertMockMyRegistration(req.params.id, status, count);
      return {
        group_id: req.params.groupId,
        user_id: currentMockUser().id,
        status,
        registration_count: status === "cancelled" ? 0 : count,
        updated_at: new Date().toISOString(),
      };
    },
  },
  {
    method: "DELETE",
    pattern: "/matches/:id/groups/:groupId/my-registration",
    handler: (req) => {
      ensureMockRegistrationOpen(req.params.id);
      upsertMockMyRegistration(req.params.id, "cancelled", 0);
      return {
        group_id: req.params.groupId,
        user_id: currentMockUser().id,
        status: "cancelled",
        registration_count: 0,
        updated_at: new Date().toISOString(),
      };
    },
  },
  {
    method: "GET",
    pattern: "/matches/:id/team-applications",
    handler: (req) => mockTeamApplicationsFor(req.params.id),
  },
  {
    method: "POST",
    pattern: "/matches/:id/team-applications",
    handler: (req) => {
      ensureMockRegistrationOpen(req.params.id);
      return createMockTeamApplication(req.params.id, req.body as { team_id?: number; introduction?: string });
    },
  },
  {
    method: "POST",
    pattern: "/matches/:id/team-applications/:applicationId/withdraw",
    handler: (req) => withdrawMockTeamApplication(req.params.id, req.params.applicationId),
  },
  {
    method: "POST",
    pattern: "/matches/:id/team-applications/:applicationId/select",
    handler: (req) => selectMockTeamApplication(req.params.id, req.params.applicationId),
  },
  {
    method: "POST",
    pattern: "/challenges/:id/accept",
    handler: (req) => getMockChallengeDetail(req.params.id)?.summary.challenge ?? undefined,
  },
  {
    method: "POST",
    pattern: "/challenges/:id/cancel",
    handler: (req) => getMockChallengeDetail(req.params.id)?.summary.challenge ?? undefined,
  },
  {
    method: "DELETE",
    pattern: "/challenges/:id/individual-acceptance",
    handler: (req) => getMockChallengeDetail(req.params.id)?.summary.challenge ?? undefined,
  },

  // ===== 账户 / 账单 =====
  {
    method: "GET",
    pattern: "/wallet",
    handler: () => mockWalletAccount,
  },
  {
    method: "GET",
    pattern: "/team-fund/balances",
    handler: () => mockTeamFundBalances,
  },
  {
    method: "GET",
    pattern: "/team-fund/transactions",
    handler: (req) => {
      const limit = req.query.limit ? Number(req.query.limit) : mockTeamFundTransactions.length;
      return mockTeamFundTransactions.slice(0, Number.isFinite(limit) ? limit : mockTeamFundTransactions.length);
    },
  },
  {
    method: "GET",
    pattern: "/payments/orders",
    handler: (req) => {
      const pageSize = req.query.page_size ? Number(req.query.page_size) : mockPaymentOrders.items.length;
      const size = Number.isFinite(pageSize) ? pageSize : mockPaymentOrders.items.length;
      return { ...mockPaymentOrders, page_size: size, items: mockPaymentOrders.items.slice(0, size) };
    },
  },

  // ===== 系统 =====
  {
    method: "GET",
    pattern: "/system/mini-app-runtime-config",
    handler: () => defaultMiniAppRuntimeConfig,
  },
  {
    method: "GET",
    pattern: "/system/map-preview-settings",
    handler: () => ({ selected_provider: "tencent", tencent_map_key: "" }),
  },

  // ===== 通知 =====
  {
    method: "GET",
    pattern: "/notifications/unread-count",
    handler: () => ({ unread_count: 2 }),
  },
  {
    method: "GET",
    pattern: "/notifications",
    handler: (req) => {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const items = req.query.unread_only
        ? mockNotifications.filter((item) => !item.read_at)
        : mockNotifications;
      return limit ? items.slice(0, limit) : items;
    },
  },
  {
    method: "POST",
    pattern: "/notifications/read-all",
    handler: () => ({ affected: mockNotifications.length }),
  },
];

/** 将路径模式编译为正则和参数名列表 */
function compilePattern(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const regexStr = pattern.replace(/:(\w+)/g, (_, name: string) => {
    paramNames.push(name);
    return "([^/]+)";
  });
  return { regex: new RegExp(`^${regexStr}$`), paramNames };
}

const compiledRoutes = routes.map((route) => ({
  ...route,
  compiled: compilePattern(route.pattern),
}));

/** 从完整 URL 路径中分离出路径和 query 参数 */
export function parseUrl(rawPath: string): { path: string; query: Record<string, string> } {
  const [pathOnly, queryString] = rawPath.split("?");
  const query: Record<string, string> = {};
  if (queryString) {
    for (const pair of queryString.split("&")) {
      const [key, value] = pair.split("=");
      if (key) query[decodeURIComponent(key)] = value ? decodeURIComponent(value) : "";
    }
  }
  return { path: pathOnly, query };
}

/**
 * 尝试匹配 mock 路由。
 *
 * @param method HTTP 方法
 * @param rawPath 含 query string 的路径（如 "/activity/infos?page=1&team_id=101"）
 * @param body 请求体
 * @returns 完整 envelope（BackendApiResponse），或 null 表示未命中
 */
export function resolveMockResponse(method: string, rawPath: string, body: unknown): BackendApiResponse<unknown> | null {
  const { path, query } = parseUrl(rawPath);

  for (const route of compiledRoutes) {
    if (route.method.toUpperCase() !== method.toUpperCase()) continue;

    const match = route.compiled.regex.exec(path);
    if (!match) continue;

    const params: Record<string, string> = {};
    route.compiled.paramNames.forEach((name, index) => {
      params[name] = decodeURIComponent(match[index + 1]);
    });

    const result = route.handler({ path, segments: path.split("/").filter(Boolean), params, query, body });
    if (result === undefined) continue;

    return buildEnvelope(result);
  }

  return null;
}
