import type {
  AppHomeActionMatch,
  AppHomeEndedMatch,
  AppHomeMatchGroup,
  AppMatchDetailResponse,
  AppMatchGroupDetail,
  AppMatchHomeResponse,
  AppMatchParticipant,
  AppMatchRegistration,
  AppMatchRegistrationStatus,
  AppMatchRegistrationGroupSummary,
  AppMatchStatus,
  AppMatchSummary,
} from "@/types/match";
import { TEAM_ID_HEXI, TEAM_ID_MINGYUE, mockTeams } from "./teams";
import { mockUsers } from "./users";

/** 首页卡片报名头像：循环取 mock 用户模拟已报名队员；registered_at 按序递增模拟报名先后。 */
function mockHomeParticipants(count: number, baseNow = Date.now()): AppMatchParticipant[] {
  return Array.from({ length: count }, (_, index) => {
    const user = mockUsers[index % mockUsers.length];
    return {
      user_id: user.id,
      nickname: user.nickname,
      avatar_url: user.avatar_url,
      status: "attending" as const,
      registered_at: isoOffsetMinutes(baseNow, -60 + index * 5),
    };
  });
}

function isoOffsetMinutes(baseNow: number, minutes: number): string {
  return new Date(baseNow + minutes * 60_000).toISOString();
}

/** 与当前 mock 用户（37 号）无关的外部球队，用于构造列表查询夹具。 */
const EXTERNAL_TEAM_NAMES: Record<number, string> = {
  201: "麓山联队",
  202: "锦江之星 FC",
  203: "城南联盟",
};

function teamName(teamId: number): string {
  return mockTeams.find((team) => team.id === teamId)?.name ?? EXTERNAL_TEAM_NAMES[teamId] ?? `球队 #${teamId}`;
}

interface MatchSeed {
  id: string;
  name: string;
  status: AppMatchStatus;
  publication_mode: AppMatchSummary["publication_mode"];
  opponent_state: AppMatchSummary["opponent_state"];
  host_team_id: number;
  away_team_id: number | null;
  opponent_name: string | null;
  players_per_team: number;
  location: string;
  location_latitude: number | null;
  location_longitude: number | null;
  description: string | null;
  start_offset_minutes: number;
  duration_minutes: number;
  created_offset_minutes: number;
  updated_offset_minutes?: number;
}

interface ActionMatchSeed extends MatchSeed {
  group: AppHomeMatchGroup;
}

/** seed 是静态常量，收尾操作的状态变更以 override 记录，避免修改模块常量。 */
const matchStatusOverrides = new Map<string, AppMatchStatus>();

function buildSummary(seed: MatchSeed, baseNow: number): AppMatchSummary {
  const startTime = isoOffsetMinutes(baseNow, seed.start_offset_minutes);
  const endTime = isoOffsetMinutes(baseNow, seed.start_offset_minutes + seed.duration_minutes);

  return {
    id: seed.id,
    name: seed.name,
    status: matchStatusOverrides.get(seed.id) ?? seed.status,
    start_time: startTime,
    end_time: endTime,
    publication_mode: seed.publication_mode,
    opponent_state: seed.opponent_state,
    host_team_id: seed.host_team_id,
    host_team_name: teamName(seed.host_team_id),
    away_team_id: seed.away_team_id,
    away_team_name: seed.away_team_id === null ? null : teamName(seed.away_team_id),
    opponent_name: seed.opponent_name,
    players_per_team: seed.players_per_team,
    registration_start_at: null,
    registration_end_at: null,
    location: seed.location,
    location_latitude: seed.location_latitude,
    location_longitude: seed.location_longitude,
    description: seed.description,
    is_free: true,
    registration_groups: buildRegistrationGroupSummaries(seed),
    created_at: isoOffsetMinutes(baseNow, seed.created_offset_minutes),
    updated_at: isoOffsetMinutes(baseNow, seed.updated_offset_minutes ?? seed.created_offset_minutes + 5),
  };
}

/** 约队大厅卡片进度依赖报名组摘要：主队组始终存在，散人模式追加散人组。 */
function buildRegistrationGroupSummaries(seed: MatchSeed): AppMatchRegistrationGroupSummary[] {
  const groups: AppMatchRegistrationGroupSummary[] = [
    {
      kind: "host_team",
      team_id: seed.host_team_id,
      min_players: null,
      max_players: seed.players_per_team,
      attending_count: Math.max(seed.players_per_team - 2, 1),
    },
  ];
  if (seed.publication_mode === "online_individual") {
    const minPlayers = Math.max(seed.players_per_team - 2, 3);
    groups.push({
      kind: "individual_opponent",
      team_id: null,
      min_players: minPlayers,
      max_players: seed.players_per_team,
      attending_count: Math.max(minPlayers - 1, 0),
    });
  }
  return groups;
}

function buildActionMatch(seed: ActionMatchSeed, baseNow: number): AppHomeActionMatch {
  const summary = buildSummary(seed, baseNow);
  return {
    id: summary.id,
    status: summary.status,
    start_time: summary.start_time,
    end_time: summary.end_time,
    name: summary.name,
    publication_mode: summary.publication_mode,
    host_team_name: summary.host_team_name,
    opponent_name: summary.opponent_name ?? "",
    players_per_team: summary.players_per_team,
    location: summary.location,
    group: seed.group,
  };
}

function buildEndedMatch(seed: MatchSeed, baseNow: number): AppHomeEndedMatch {
  const summary = buildSummary(seed, baseNow);
  return {
    id: summary.id,
    status: summary.status,
    start_time: summary.start_time,
    end_time: summary.end_time,
    name: summary.name,
    publication_mode: summary.publication_mode,
    host_team_name: summary.host_team_name,
    opponent_name: summary.opponent_name ?? "",
    location: summary.location,
    participants: mockHomeParticipants(Math.max(1, seed.players_per_team - 2), baseNow),
  };
}

function mockGroupId(matchId: string): string {
  return `${matchId.slice(0, -4)}d${matchId.slice(-3)}`;
}

function compareSummary(left: AppMatchSummary, right: AppMatchSummary): number {
  if (left.start_time !== right.start_time) {
    return left.start_time > right.start_time ? -1 : 1;
  }
  return left.id.localeCompare(right.id);
}

function compareAction(left: AppHomeActionMatch, right: AppHomeActionMatch): number {
  if (left.status !== right.status) {
    return left.status === "ongoing" ? -1 : 1;
  }
  if (left.start_time !== right.start_time) {
    return left.start_time < right.start_time ? -1 : 1;
  }
  return left.id.localeCompare(right.id);
}

function compareEnded(left: AppHomeEndedMatch, right: AppHomeEndedMatch): number {
  if (left.end_time !== right.end_time) {
    return left.end_time > right.end_time ? -1 : 1;
  }
  return left.id.localeCompare(right.id);
}

/** 当前 mock 用户是洺悦御府队长、河西周四 FC 队员；主/客队命中任一即视为「与我相关」。 */
function isRelatedToCurrentUser(seed: MatchSeed): boolean {
  return (
    seed.host_team_id === TEAM_ID_MINGYUE ||
    seed.host_team_id === TEAM_ID_HEXI ||
    seed.away_team_id === TEAM_ID_MINGYUE ||
    seed.away_team_id === TEAM_ID_HEXI
  );
}

const seedMatches: MatchSeed[] = [
  {
    id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c001",
    name: "洺悦御府周末约战",
    status: "registering",
    publication_mode: "online_team",
    opponent_state: "recruiting",
    host_team_id: TEAM_ID_MINGYUE,
    away_team_id: null,
    opponent_name: "青龙场联队",
    players_per_team: 8,
    location: "驿马河体育公园 1 号场",
    location_latitude: 30.6428,
    location_longitude: 104.0668,
    description: "周末主场约战，欢迎继续报名。",
    start_offset_minutes: 2 * 24 * 60 + 120,
    duration_minutes: 120,
    created_offset_minutes: -2 * 24 * 60,
  },
  {
    id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c002",
    name: "河西周四 FC 友谊赛",
    status: "registering",
    publication_mode: "online_team",
    opponent_state: "recruiting",
    host_team_id: TEAM_ID_HEXI,
    away_team_id: null,
    opponent_name: "星火足球队",
    players_per_team: 7,
    location: "府河绿道足球场",
    location_latitude: 30.6512,
    location_longitude: 104.0432,
    description: "晚场友谊赛，客队仍在召集。",
    start_offset_minutes: 5 * 24 * 60 + 90,
    duration_minutes: 120,
    created_offset_minutes: -3 * 24 * 60,
  },
  {
    id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003",
    name: "洺悦御府对河西周四 FC",
    status: "ongoing",
    publication_mode: "offline_confirmed",
    opponent_state: "confirmed",
    host_team_id: TEAM_ID_MINGYUE,
    away_team_id: TEAM_ID_HEXI,
    opponent_name: "河西周四 FC",
    players_per_team: 8,
    location: "青龙场足球公园",
    location_latitude: 30.689,
    location_longitude: 104.101,
    description: "已确认的正式比赛，双方都已到场。",
    start_offset_minutes: -45,
    duration_minutes: 120,
    created_offset_minutes: -5 * 24 * 60,
  },
  {
    id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c004",
    name: "河西周四 FC 夜训赛",
    status: "ongoing",
    publication_mode: "online_team",
    opponent_state: "confirmed",
    host_team_id: TEAM_ID_HEXI,
    away_team_id: null,
    opponent_name: "西城联合",
    players_per_team: 6,
    location: "锦城湖 3 号场",
    location_latitude: 30.5901,
    location_longitude: 104.0632,
    description: "进行中的夜间练习赛。",
    start_offset_minutes: -90,
    duration_minutes: 150,
    created_offset_minutes: -6 * 24 * 60,
  },
  {
    id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c005",
    name: "洺悦御府历史补赛",
    status: "ongoing",
    publication_mode: "online_individual",
    opponent_state: "confirmed",
    host_team_id: TEAM_ID_MINGYUE,
    away_team_id: null,
    opponent_name: "老朋友 FC",
    players_per_team: 5,
    location: "东湖公园 5 号场",
    location_latitude: 30.6289,
    location_longitude: 104.0795,
    description: "时间已结束但状态尚未收敛的旧数据。",
    start_offset_minutes: -5 * 60,
    duration_minutes: 120,
    created_offset_minutes: -10 * 24 * 60,
  },
  {
    id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c006",
    name: "河西周四 FC 老赛程",
    status: "registering",
    publication_mode: "online_team",
    // 已确认洺悦御府为客队且时间已过：当前 mock 用户（洺悦御府队长）以客队队长身份收尾。
    opponent_state: "confirmed",
    host_team_id: TEAM_ID_HEXI,
    away_team_id: TEAM_ID_MINGYUE,
    opponent_name: "洺悦御府",
    players_per_team: 8,
    location: "银杏体育公园",
    location_latitude: 30.6735,
    location_longitude: 104.0987,
    description: "时间已结束但报名状态仍停留在报名中。",
    start_offset_minutes: -2 * 24 * 60 - 180,
    duration_minutes: 90,
    created_offset_minutes: -12 * 24 * 60,
  },
  {
    id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c007",
    name: "洺悦御府正式收官赛",
    status: "ended",
    publication_mode: "offline_confirmed",
    opponent_state: "confirmed",
    host_team_id: TEAM_ID_MINGYUE,
    away_team_id: TEAM_ID_HEXI,
    opponent_name: "河西周四 FC",
    players_per_team: 8,
    location: "驿马河体育公园 2 号场",
    location_latitude: 30.6432,
    location_longitude: 104.0672,
    description: "已结束的正式比赛。",
    start_offset_minutes: -7 * 24 * 60,
    duration_minutes: 120,
    created_offset_minutes: -15 * 24 * 60,
  },
  {
    id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c008",
    name: "河西周四 FC 赛季收官",
    status: "ended",
    publication_mode: "online_team",
    opponent_state: "confirmed",
    host_team_id: TEAM_ID_HEXI,
    away_team_id: null,
    opponent_name: "青年联队",
    players_per_team: 7,
    location: "府河绿道足球场",
    location_latitude: 30.6514,
    location_longitude: 104.0436,
    description: "收官后的回顾场次。",
    start_offset_minutes: -12 * 24 * 60,
    duration_minutes: 120,
    created_offset_minutes: -20 * 24 * 60,
  },
  {
    id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c009",
    name: "洺悦御府临时取消赛",
    status: "cancelled",
    publication_mode: "online_individual",
    opponent_state: "no_recruitment",
    host_team_id: TEAM_ID_MINGYUE,
    away_team_id: null,
    opponent_name: "取消对手",
    players_per_team: 6,
    location: "锦城湖 1 号场",
    location_latitude: 30.5903,
    location_longitude: 104.0636,
    description: "已取消的计划场次。",
    start_offset_minutes: 10 * 24 * 60,
    duration_minutes: 90,
    created_offset_minutes: -1 * 24 * 60,
  },
  // ===== 与当前用户无关的比赛（外部球队主办，用于「进行中」区域 / scope=others） =====
  {
    id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c011",
    name: "麓山联队周末公开赛",
    status: "registering",
    publication_mode: "online_team",
    opponent_state: "recruiting",
    host_team_id: 201,
    away_team_id: null,
    opponent_name: "来者不拒",
    players_per_team: 8,
    location: "麓山足球场 2 号场",
    location_latitude: 30.5988,
    location_longitude: 104.0712,
    description: "外部球队主办的公开赛，欢迎围观。",
    start_offset_minutes: 3 * 24 * 60,
    duration_minutes: 120,
    created_offset_minutes: -2 * 24 * 60,
  },
  {
    id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c012",
    name: "锦江之星 FC 挑战赛",
    status: "registering",
    publication_mode: "online_individual",
    opponent_state: "recruiting",
    host_team_id: 202,
    away_team_id: null,
    opponent_name: "散人联队",
    players_per_team: 7,
    location: "锦江体育公园",
    location_latitude: 30.6571,
    location_longitude: 104.0812,
    description: "散人招募中的挑战赛。",
    start_offset_minutes: 4 * 24 * 60 + 60,
    duration_minutes: 120,
    created_offset_minutes: -3 * 24 * 60,
  },
  {
    id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c013",
    name: "麓山联队友谊邀请赛",
    status: "registering",
    publication_mode: "online_team",
    opponent_state: "confirmed",
    host_team_id: 201,
    away_team_id: 203,
    opponent_name: "城南联盟",
    players_per_team: 6,
    location: "麓山足球场 1 号场",
    location_latitude: 30.5986,
    location_longitude: 104.071,
    description: "已确认对手的外部友谊赛。",
    start_offset_minutes: 6 * 24 * 60,
    duration_minutes: 90,
    created_offset_minutes: -4 * 24 * 60,
  },
  {
    id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c014",
    name: "城南联盟杯小组赛",
    status: "registering",
    publication_mode: "online_team",
    opponent_state: "recruiting",
    host_team_id: 203,
    away_team_id: null,
    opponent_name: "待定",
    players_per_team: 8,
    location: "城南体育中心",
    location_latitude: 30.5721,
    location_longitude: 104.0512,
    description: "小组循环赛制，仍在招募参赛队。",
    start_offset_minutes: 8 * 24 * 60,
    duration_minutes: 120,
    created_offset_minutes: -5 * 24 * 60,
  },
  {
    id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c015",
    name: "麓山联队主场进行时",
    status: "ongoing",
    publication_mode: "offline_confirmed",
    opponent_state: "confirmed",
    host_team_id: 201,
    away_team_id: 202,
    opponent_name: "锦江之星 FC",
    players_per_team: 8,
    location: "麓山足球场 3 号场",
    location_latitude: 30.599,
    location_longitude: 104.0715,
    description: "已经开始的外部比赛，不应出现在「进行中」区域（仅未开始的无关比赛可见）。",
    start_offset_minutes: -30,
    duration_minutes: 120,
    created_offset_minutes: -6 * 24 * 60,
  },
];

interface CreatedMockMatch {
  summary: AppMatchSummary;
  group: AppHomeMatchGroup;
}

let createdMatchSequence = 0;
const createdMatches: CreatedMockMatch[] = [];

function buildCreatedMatch(payload: {
  name: string;
  publication_mode: AppMatchSummary["publication_mode"];
  /** 散人约球（online_pickup）没有主队。 */
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
  is_free?: boolean;
  payment_mode?: AppMatchSummary["payment_mode"];
  fee_per_person_cents?: number;
}): CreatedMockMatch {
  createdMatchSequence += 1;
  const id = `c7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7${String(createdMatchSequence).padStart(4, "0")}`;
  const now = new Date().toISOString();
  const isPickup = payload.publication_mode === "online_pickup";
  const summary: AppMatchSummary = {
    id,
    name: payload.name,
    status: "registering",
    start_time: payload.start_time,
    registration_start_at: payload.registration_start_at ?? null,
    registration_end_at: payload.registration_end_at ?? null,
    end_time: payload.end_time,
    publication_mode: payload.publication_mode,
    opponent_state: payload.publication_mode === "offline_confirmed" ? "confirmed" : "recruiting",
    host_team_id: payload.host_team_id ?? null,
    host_team_name: payload.host_team_id ? teamName(payload.host_team_id) : "",
    away_team_id: null,
    away_team_name: null,
    opponent_name: payload.opponent_name ?? null,
    players_per_team: payload.players_per_team,
    location: payload.location,
    location_latitude: payload.location_latitude ?? null,
    location_longitude: payload.location_longitude ?? null,
    description: payload.description ?? null,
    is_free: payload.is_free ?? true,
    payment_mode: payload.payment_mode ?? "postpaid",
    fee_per_person_cents: payload.fee_per_person_cents ?? 0,
    created_at: now,
    updated_at: now,
  };
  const group: AppHomeMatchGroup = {
    id: mockGroupId(id),
    // 散人约球（pickup）没有主队组，全部报名进散人组；与后端 NewMatch 的分组规则一致。
    kind: isPickup ? "individual_opponent" : "host_team",
    status: payload.publication_mode === "offline_confirmed" ? "closed" : "open",
    min_players: payload.publication_mode === "online_individual"
      ? 6
      : isPickup
        ? payload.players_per_team * 2
        : null,
    max_players: payload.host_capacity_limit ?? payload.players_per_team,
    attending_count: 0,
    my_registration_status: "unknown",
  };
  const created = { summary, group };
  createdMatches.push(created);
  return created;
}

function buildCreatedActionMatch(created: CreatedMockMatch): AppHomeActionMatch {
  return {
    id: created.summary.id,
    status: created.summary.status,
    start_time: created.summary.start_time,
    end_time: created.summary.end_time,
    name: created.summary.name,
    publication_mode: created.summary.publication_mode,
    host_team_name: created.summary.host_team_name,
    opponent_name: created.summary.opponent_name ?? "",
    players_per_team: created.summary.players_per_team,
    location: created.summary.location,
    group: created.group,
  };
}

function buildCreatedEndedMatch(created: CreatedMockMatch): AppHomeEndedMatch {
  return {
    id: created.summary.id,
    status: created.summary.status,
    start_time: created.summary.start_time,
    end_time: created.summary.end_time,
    name: created.summary.name,
    publication_mode: created.summary.publication_mode,
    host_team_name: created.summary.host_team_name,
    opponent_name: created.summary.opponent_name ?? "",
    location: created.summary.location,
  };
}

function buildMyMatches(baseNow = Date.now()): AppMatchSummary[] {
  return [...seedMatches.map((seed) => buildSummary(seed, baseNow)), ...createdMatches.map((item) => applyStatusOverride(item.summary))].sort(compareSummary);
}

function applyStatusOverride(summary: AppMatchSummary): AppMatchSummary {
  const status = matchStatusOverrides.get(summary.id);
  return status ? { ...summary, status } : summary;
}

/** 主队管理方收尾比赛：与后端一致，仅允许已过结束时间的非终态比赛标记 ended / cancelled。 */
export function updateMockMatchStatus(matchId: string, status: "ended" | "cancelled", baseNow = Date.now()): AppMatchDetailResponse | undefined {
  const match = buildMyMatches(baseNow).find((item) => item.id === matchId);
  if (!match) return undefined;
  if (match.status === "ended" || match.status === "cancelled") {
    throw new Error("比赛已结束或已取消，不能再次变更");
  }
  const endTimestamp = Date.parse(match.end_time);
  if (Number.isFinite(endTimestamp) && baseNow <= endTimestamp) {
    throw new Error("比赛尚未到结束时间，暂不能收尾");
  }
  matchStatusOverrides.set(matchId, status);
  return getMockMatchDetail(matchId, baseNow);
}

function buildMatchHome(baseNow = Date.now()): AppMatchHomeResponse {
  const actionSeeds = seedMatches.filter(
    (seed) =>
      isRelatedToCurrentUser(seed) &&
      (seed.status === "registering" || seed.status === "ongoing") &&
      seed.start_offset_minutes + seed.duration_minutes > 0,
  );
  const actionMatches = [
    ...actionSeeds
    .map((seed) =>
      buildActionMatch({
        ...seed,
        group: {
          id: mockGroupId(seed.id),
          kind: "host_team",
          status: seed.status === "registering" ? "open" : "closed",
          min_players: seed.status === "registering" ? 6 : 5,
          max_players: seed.players_per_team,
          attending_count: seed.status === "registering" ? 0 : Math.max(1, seed.players_per_team - 2),
          participants: seed.status === "registering" ? [] : mockHomeParticipants(Math.max(1, seed.players_per_team - 2), baseNow),
          my_registration_status:
            seed.status === "registering" ? "unknown" : seed.id === "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c005" ? "leave" : "attending",
        },
      }, baseNow),
    ),
    ...createdMatches
      .filter((item) => Date.parse(item.summary.end_time) > baseNow)
      .map(buildCreatedActionMatch),
  ]
    .sort(compareAction)
    .slice(0, 3);

  const endedSeeds = seedMatches.filter(
    (seed) => isRelatedToCurrentUser(seed) && (seed.status === "ended" || seed.start_offset_minutes + seed.duration_minutes <= 0),
  );
  const endedMatches = [
    ...endedSeeds.map((seed) => buildEndedMatch(seed, baseNow)),
    ...createdMatches
      .filter((item) => Date.parse(item.summary.end_time) <= baseNow)
      .map(buildCreatedEndedMatch),
  ]
    .sort(compareEnded)
    .slice(0, 6);

  return {
    action_items: actionMatches,
    action_has_more: actionSeeds.length + createdMatches.filter((item) => Date.parse(item.summary.end_time) > baseNow).length > actionMatches.length,
    ended_items: endedMatches,
    ended_has_more: endedSeeds.length + createdMatches.filter((item) => Date.parse(item.summary.end_time) <= baseNow).length > endedMatches.length,
  };
}

export function mockMyMatches(baseNow = Date.now()): AppMatchSummary[] {
  return [
    ...seedMatches
      .filter((seed) => isRelatedToCurrentUser(seed))
      .map((seed) => buildSummary(seed, baseNow)),
    ...createdMatches.map((item) => item.summary),
  ].sort(compareSummary);
}

export function mockOtherMatches(baseNow = Date.now()): AppMatchSummary[] {
  return seedMatches
    .filter((seed) => !isRelatedToCurrentUser(seed))
    .map((seed) => buildSummary(seed, baseNow))
    .sort(compareSummary);
}

/** 按列表查询参数过滤：scope、名称/地点模糊搜索、starts_after、状态、发布模式和日期。 */
export function filterMockMatchesByQuery(query: Record<string, string>, baseNow = Date.now()): AppMatchSummary[] {
  let items: AppMatchSummary[];
  switch (query.scope) {
    case "mine":
      items = mockMyMatches(baseNow);
      break;
    case "others":
      items = mockOtherMatches(baseNow);
      break;
    default:
      items = buildMyMatches(baseNow);
      break;
  }

  const search = query.search?.trim().toLocaleLowerCase();
  if (search) {
    items = items.filter((item) => (
      `${item.name} ${item.location}`.toLocaleLowerCase().includes(search)
    ));
  }

  if (query.starts_after) {
    const threshold = Date.parse(query.starts_after);
    if (Number.isFinite(threshold)) {
      items = items.filter((item) => Date.parse(item.start_time) > threshold);
    }
  }

  if (query.status) {
    items = items.filter((item) => item.status === query.status);
  }

  if (query.publication_modes) {
    const modes = query.publication_modes.split(",").map((mode) => mode.trim()).filter(Boolean);
    if (modes.length) {
      items = items.filter((item) => modes.includes(item.publication_mode));
    }
  }

  if (query.date_start) {
    // 与后端一致：date_start 是"该时刻起的 24 小时窗口"。
    const dayStart = Date.parse(query.date_start);
    if (Number.isFinite(dayStart)) {
      items = items.filter((item) => {
        const start = Date.parse(item.start_time);
        return start >= dayStart && start < dayStart + 24 * 60 * 60 * 1000;
      });
    }
  }

  return items;
}

export function mockMatchHome(baseNow = Date.now()): AppMatchHomeResponse {
  return buildMatchHome(baseNow);
}

export function createMockMatch(payload: Parameters<typeof buildCreatedMatch>[0]): AppMatchDetailResponse {
  const created = buildCreatedMatch(payload);
  const group: AppMatchGroupDetail = {
    id: created.group.id,
    kind: created.group.kind,
    team_id: created.group.kind === "host_team" ? created.summary.host_team_id : null,
    status: created.group.status,
    min_players: created.group.min_players,
    max_players: created.group.max_players,
    attending_count: created.group.attending_count,
    my_registration: null,
  };
  return { match: created.summary, groups: [group] };
}

export function getMockMatchDetail(matchId: string, baseNow = Date.now()): AppMatchDetailResponse | undefined {
  const match = buildMyMatches(baseNow).find((item) => item.id === matchId);
  if (!match) return undefined;

  const actionMatch = buildMatchHome(baseNow).action_items.find((item) => item.id === matchId);
  const fallbackKind = match.publication_mode === "online_individual" || match.publication_mode === "online_pickup"
    ? "individual_opponent"
    : "host_team";
  const override = mockMyRegistrationOverrides.get(matchId);
  const registrationStatus = override?.status ?? actionMatch?.group.my_registration_status;
  // 详情页「已报名队员」头像来自 group.participants；mock 与真实接口对齐，都带报名先后时间。
  const attendingCount = actionMatch?.group.attending_count
    ?? (match.status === "registering" ? 0 : Math.max(1, match.players_per_team - 2));
  const participants = actionMatch?.group.participants ?? mockHomeParticipants(attendingCount, baseNow);

  return {
    match,
    groups: [{
      id: actionMatch?.group.id ?? mockGroupId(match.id),
      kind: actionMatch?.group.kind ?? fallbackKind,
      team_id: match.host_team_id,
      status: actionMatch?.group.status ?? (match.status === "registering" ? "open" : "closed"),
      min_players: actionMatch?.group.min_players ?? match.players_per_team,
      max_players: actionMatch?.group.max_players ?? match.players_per_team,
      attending_count: attendingCount,
      participants,
      my_registration:
        registrationStatus && registrationStatus !== "unknown" && registrationStatus !== "cancelled"
          ? {
              status: registrationStatus,
              registration_count: registrationStatus === "attending" ? override?.count ?? 1 : 0,
              paid: override?.paid ?? false,
            }
          : null,
    }],
  };
}

// mock 报名覆盖：PUT/DELETE my-registration 与支付核销后落地，详情读取时回放（散人约球多人报名可体验）。
const mockMyRegistrationOverrides = new Map<string, { status: AppMatchRegistrationStatus; count: number; paid: boolean }>();

export function upsertMockMyRegistration(matchId: string, status: string, count: number) {
  if (status === "cancelled" || count < 1) {
    mockMyRegistrationOverrides.delete(matchId);
    return;
  }
  mockMyRegistrationOverrides.set(matchId, { status: status as AppMatchRegistrationStatus, count, paid: mockMyRegistrationOverrides.get(matchId)?.paid ?? false });
}

export function markMockMyRegistrationPaid(matchId: string) {
  const current = mockMyRegistrationOverrides.get(matchId);
  if (current) mockMyRegistrationOverrides.set(matchId, { ...current, paid: true });
}

export function mockMyRegistrationCount(matchId: string): number {
  const current = mockMyRegistrationOverrides.get(matchId);
  return current && current.status === "attending" ? current.count : 1;
}

export function paginateMockMatches(matches: AppMatchSummary[], query: Record<string, string>) {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.page_size ?? 10);
  const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const normalizedPageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 10;
  const start = (normalizedPage - 1) * normalizedPageSize;

  return {
    items: matches.slice(start, start + normalizedPageSize),
    total: matches.length,
    page: normalizedPage,
    page_size: normalizedPageSize,
  };
}
