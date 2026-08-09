import type {
  AppHomeActionMatch,
  AppHomeEndedMatch,
  AppHomeMatchGroup,
  AppMatchHomeResponse,
  AppMatchStatus,
  AppMatchSummary,
} from "@/types/match";
import { TEAM_ID_HEXI, TEAM_ID_MINGYUE, mockTeams } from "./teams";

const now = Date.now();

function isoOffsetMinutes(minutes: number): string {
  return new Date(now + minutes * 60_000).toISOString();
}

function teamName(teamId: number): string {
  return mockTeams.find((team) => team.id === teamId)?.name ?? `球队 #${teamId}`;
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

function buildSummary(seed: MatchSeed): AppMatchSummary {
  const startTime = isoOffsetMinutes(seed.start_offset_minutes);
  const endTime = isoOffsetMinutes(seed.start_offset_minutes + seed.duration_minutes);

  return {
    id: seed.id,
    name: seed.name,
    status: seed.status,
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
    location: seed.location,
    location_latitude: seed.location_latitude,
    location_longitude: seed.location_longitude,
    description: seed.description,
    created_at: isoOffsetMinutes(seed.created_offset_minutes),
    updated_at: isoOffsetMinutes(seed.updated_offset_minutes ?? seed.created_offset_minutes + 5),
  };
}

function buildActionMatch(seed: ActionMatchSeed): AppHomeActionMatch {
  const summary = buildSummary(seed);
  return {
    id: summary.id,
    status: summary.status,
    start_time: summary.start_time,
    end_time: summary.end_time,
    name: summary.name,
    host_team_name: summary.host_team_name,
    opponent_name: summary.opponent_name ?? "",
    players_per_team: summary.players_per_team,
    location: summary.location,
    group: seed.group,
  };
}

function buildEndedMatch(seed: MatchSeed): AppHomeEndedMatch {
  const summary = buildSummary(seed);
  return {
    id: summary.id,
    status: summary.status,
    start_time: summary.start_time,
    end_time: summary.end_time,
    name: summary.name,
    host_team_name: summary.host_team_name,
    opponent_name: summary.opponent_name ?? "",
    location: summary.location,
  };
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
  if (left.start_time !== right.start_time) {
    return left.start_time > right.start_time ? -1 : 1;
  }
  return left.id.localeCompare(right.id);
}

const seedMatches: MatchSeed[] = [
  {
    id: "match-001",
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
    id: "match-002",
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
    id: "match-003",
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
    id: "match-004",
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
    id: "match-005",
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
    id: "match-006",
    name: "河西周四 FC 老赛程",
    status: "registering",
    publication_mode: "online_team",
    opponent_state: "recruiting",
    host_team_id: TEAM_ID_HEXI,
    away_team_id: null,
    opponent_name: "北门联队",
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
    id: "match-007",
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
    id: "match-008",
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
    id: "match-009",
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
];

const allMatches = seedMatches.map(buildSummary).sort(compareSummary);

const actionMatches = seedMatches
  .filter((seed) => seed.status === "registering" || seed.status === "ongoing")
  .map((seed) =>
    buildActionMatch({
      ...seed,
      group: {
        id: `${seed.id}-group`,
        kind: "host_team",
        status: seed.status === "registering" ? "open" : "closed",
        min_players: seed.status === "registering" ? 6 : 5,
        max_players: seed.players_per_team,
        attending_count: seed.status === "registering" ? 0 : Math.max(1, seed.players_per_team - 2),
        my_registration_status:
          seed.status === "registering" ? "unknown" : seed.id === "match-005" ? "leave" : "attending",
      },
    }),
  )
  .sort(compareAction)
  .slice(0, 3);

const endedMatches = seedMatches
  .filter((seed) => seed.status === "ended")
  .map(buildEndedMatch)
  .sort(compareEnded)
  .slice(0, 6);

export const mockMyMatches: AppMatchSummary[] = allMatches;

export const mockMatchHome: AppMatchHomeResponse = {
  action_items: actionMatches,
  ended_items: endedMatches,
  ended_has_more: seedMatches.filter((seed) => seed.status === "ended").length > endedMatches.length,
};

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
