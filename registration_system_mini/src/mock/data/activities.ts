import type {
  BackendActivity,
  BackendActivityListPage,
  BackendActivityTeamCheckInConfig,
  BackendOngoingActivityResult,
  BackendRegistration,
} from "@/types/backend";
import { TEAM_ID_MINGYUE, TEAM_ID_HEXI } from "./teams";
import { dateOffset } from "./dates";

/**
 * Mock 比赛数据（旧版 activity 概念，包含外战和队内赛）。
 *
 * 首页 buildHomeMatchCards 依赖：
 *   - home_team_id / away_team_id 与 currentTeam.id 匹配
 *   - status（0=报名中, 1=进行中, 2=已结束, 3=已取消）
 *   - holding_date 在 now 之后（isRuntimeVisibleActivity 过滤）
 *   - players_per_team 决定人数制
 *   - source_activity_id 存在 → 队内赛（internal），否则外战（external）
 */

const emptyCheckinConfigs: BackendActivityTeamCheckInConfig[] = [];

export const mockActivities: BackendActivity[] = [
  {
    id: "act-001",
    name: "周四友谊赛",
    location: "驿马河二期 1 号场",
    location_latitude: 30.6428,
    location_longitude: 104.0668,
    status: 0,
    holding_date: dateOffset(2, 20, 0),
    start_time: dateOffset(2, 20, 0),
    end_time: dateOffset(2, 22, 0),
    opposing: "三圣联",
    cover: "",
    description: "本周固定友谊赛，主场对三圣联，请准时到场。",
    home_team_id: TEAM_ID_MINGYUE,
    away_team_id: null,
    color: "#9be22b",
    opposing_color: "#ea580c",
    players_per_team: 8,
    team_capacity_limit: 15,
    match_kind: "external",
    source_activity_id: null,
    team_registration_count: 7,
    team_checkin_configs: emptyCheckinConfigs,
  },
  {
    id: "act-002",
    name: "城北联赛第 3 轮",
    location: "银杏体育公园",
    location_latitude: 30.6735,
    location_longitude: 104.0987,
    status: 0,
    holding_date: dateOffset(5, 21, 30),
    start_time: dateOffset(5, 21, 30),
    end_time: dateOffset(5, 23, 0),
    opposing: "三圣联",
    cover: "",
    description: "城北联赛第三轮，客场作战。",
    home_team_id: null,
    away_team_id: TEAM_ID_MINGYUE,
    color: "#9be22b",
    opposing_color: "#2563eb",
    players_per_team: 7,
    team_capacity_limit: 13,
    match_kind: "external",
    source_activity_id: null,
    team_registration_count: 10,
    team_checkin_configs: emptyCheckinConfigs,
  },
  {
    id: "act-003",
    name: "队内分组对抗",
    location: "东湖公园 5 号场",
    location_latitude: 30.6289,
    location_longitude: 104.0795,
    status: 0,
    holding_date: dateOffset(1, 19, 45),
    start_time: dateOffset(1, 19, 45),
    end_time: dateOffset(1, 21, 30),
    opposing: "B 队",
    cover: "",
    description: "队内分组对抗赛，A 队 vs B 队。",
    home_team_id: TEAM_ID_MINGYUE,
    away_team_id: TEAM_ID_MINGYUE,
    color: "#9be22b",
    opposing_color: "#7c3aed",
    players_per_team: 6,
    team_capacity_limit: 8,
    match_kind: "internal",
    source_activity_id: "act-003",
    team_registration_count: null,
    team_checkin_configs: emptyCheckinConfigs,
  },
  {
    id: "act-004",
    name: "河西夜场约战",
    location: "府河绿道足球场",
    location_latitude: 30.6512,
    location_longitude: 104.0432,
    status: 0,
    holding_date: dateOffset(3, 20, 30),
    start_time: dateOffset(3, 20, 30),
    end_time: dateOffset(3, 22, 30),
    opposing: "柏林二队",
    cover: "",
    description: "河西周四 FC 主场夜场。",
    home_team_id: TEAM_ID_HEXI,
    away_team_id: null,
    color: "#0f766e",
    opposing_color: "#ea580c",
    players_per_team: 6,
    team_capacity_limit: 11,
    match_kind: "external",
    source_activity_id: null,
    team_registration_count: 5,
    team_checkin_configs: emptyCheckinConfigs,
  },
  {
    id: "act-005",
    name: "洺悦 vs 河西联谊赛",
    location: "青龙场足球公园",
    location_latitude: 30.689,
    location_longitude: 104.101,
    status: 0,
    holding_date: dateOffset(7, 20, 0),
    start_time: dateOffset(7, 20, 0),
    end_time: dateOffset(7, 22, 0),
    opposing: "河西周四 FC",
    cover: "",
    description: "两队联谊赛，AA 制结算。",
    home_team_id: TEAM_ID_MINGYUE,
    away_team_id: TEAM_ID_HEXI,
    color: "#9be22b",
    opposing_color: "#0f766e",
    players_per_team: 8,
    team_capacity_limit: 15,
    match_kind: "external",
    source_activity_id: null,
    team_registration_count: 8,
    team_checkin_configs: emptyCheckinConfigs,
  },
  {
    id: "act-006",
    name: "周日练习赛",
    location: "锦城湖 3 号场",
    location_latitude: 30.5901,
    location_longitude: 104.0632,
    status: 0,
    holding_date: dateOffset(9, 19, 0),
    start_time: dateOffset(9, 19, 0),
    end_time: dateOffset(9, 21, 0),
    opposing: "待定",
    cover: "",
    description: "周末练习赛，对手待定。",
    home_team_id: TEAM_ID_MINGYUE,
    away_team_id: null,
    color: "#9be22b",
    opposing_color: "#94a3b8",
    players_per_team: 5,
    team_capacity_limit: 10,
    match_kind: "external",
    source_activity_id: null,
    team_registration_count: 3,
    team_checkin_configs: emptyCheckinConfigs,
  },
];

function findActivity(id: string): BackendActivity | undefined {
  return mockActivities.find((item) => item.id === id);
}

/** 按 stand 值构造报名记录：1=参加, 2=请假, 3=迟到, 其他=待定 */
function reg(userId: number, stand: number): BackendRegistration {
  return {
    user_id: userId,
    stand,
    registration_count: stand === 1 ? 1 : 0,
    paid: 0,
    operation_time: "2026-08-07 10:00:00",
  };
}

const joinedPlayerIds = [1, 2, 3, 4, 5, 6, 7];

/** 每场活动的报名人员记录，供首页头像列表和详情页使用 */
export const mockRegistrationsByActivity: Record<string, BackendRegistration[]> = {
  "act-001": [
    reg(37, 1),
    ...joinedPlayerIds.map((id) => reg(id, 1)),
    reg(8, 2),
    reg(9, 2),
    reg(10, 3),
    reg(11, 0),
    reg(12, 0),
  ],
  "act-002": [
    reg(37, 0),
    reg(1, 1), reg(2, 1), reg(3, 1), reg(4, 1), reg(5, 1),
    reg(6, 1), reg(7, 1), reg(8, 1), reg(9, 1), reg(10, 1),
    reg(11, 2), reg(12, 0),
  ],
  "act-003": [
    reg(37, 1), reg(1, 1), reg(2, 1), reg(3, 1), reg(4, 1), reg(5, 1),
    reg(6, 1), reg(7, 1), reg(8, 0),
  ],
  "act-004": [
    reg(37, 1), reg(14, 1), reg(15, 1), reg(16, 1), reg(2, 1),
    reg(3, 2), reg(4, 0),
  ],
  "act-005": [
    reg(37, 1), reg(1, 1), reg(2, 1), reg(3, 1), reg(4, 1), reg(5, 1), reg(6, 1), reg(7, 1),
    reg(14, 1), reg(15, 1),
  ],
  "act-006": [
    reg(37, 1), reg(1, 1), reg(2, 1),
  ],
};

export function getMockActivity(id: string): BackendActivity | undefined {
  return findActivity(id);
}

export function getMockActivityUsers(id: string): BackendRegistration[] {
  return mockRegistrationsByActivity[id] ?? [];
}

/** 构造活动列表分页响应，可按 teamId 过滤 */
export function buildMockActivityListPage(params?: {
  page?: number;
  pageSize?: number;
  teamId?: number;
  holdingAfter?: string;
}): BackendActivityListPage {
  let items = [...mockActivities];

  if (params?.teamId) {
    const teamId = params.teamId;
    items = items.filter((item) => item.home_team_id === teamId || item.away_team_id === teamId);
  }

  if (params?.holdingAfter) {
    const after = params.holdingAfter.replace(" ", "T");
    items = items.filter((item) => item.holding_date.replace(" ", "T") > after);
  }

  items.sort((left, right) => left.holding_date.localeCompare(right.holding_date));

  return {
    items,
    total: items.length,
    page: params?.page ?? 1,
    page_size: params?.pageSize ?? 100,
    counts: {
      total: items.length,
      registering: items.filter((item) => item.status === 0).length,
      ongoing: items.filter((item) => item.status === 1).length,
      ended: items.filter((item) => item.status === 2).length,
      cancelled: items.filter((item) => item.status === 3).length,
    },
  };
}

export function checkMockOngoingActivity(): BackendOngoingActivityResult {
  return { has_ongoing: false, activity: null };
}
