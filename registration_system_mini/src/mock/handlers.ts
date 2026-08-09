import type { BackendApiResponse } from "@/types/backend";
import { mockCurrentUser, mockUsers, mockMyActivities } from "./data/users";
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
import { mockNotifications } from "./data/notifications";
import { mockBillingFlow, mockPaymentOrders, mockUserAccount } from "./data/billing";
import { defaultMiniAppRuntimeConfig } from "@/config/runtimeConfigDefaults";

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
  return { success: true, message: "ok", data };
}

/** 所有注册的 mock 路由 */
const routes: MockRoute[] = [
  // ===== 认证 / 用户 =====
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
    method: "PATCH",
    pattern: "/user/info",
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
    pattern: "/teams/:id",
    handler: (req) => {
      const teamId = Number(req.params.id);
      return findMockTeam(teamId) ?? undefined;
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
    pattern: "/account/balance",
    handler: () => mockUserAccount,
  },
  {
    method: "GET",
    pattern: "/order/my-billing-flow",
    handler: () => mockBillingFlow,
  },
  {
    method: "GET",
    pattern: "/payment/orders",
    handler: (req) => {
      const limit = req.query.limit ? Number(req.query.limit) : mockPaymentOrders.length;
      return mockPaymentOrders.slice(0, Number.isFinite(limit) ? limit : mockPaymentOrders.length);
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
