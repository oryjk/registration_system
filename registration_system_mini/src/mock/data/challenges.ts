import type { BackendChallenge, BackendChallengeDetail, BackendChallengeSummary } from "@/types/backend";
import { dateOffset } from "./dates";

/**
 * Mock 约队数据。
 *
 * 首页和约队大厅都需要 challenge summaries，字段与 BackendChallengeSummary 对齐。
 * 当前用户（id=37）是洺悦御府队长，relation 用于判断"我方/对方/旁观"。
 */

export const mockChallenges: BackendChallenge[] = [
  {
    id: "ch-001",
    title: "周六夜场 8 人制约队",
    kind: "team",
    payment_mode: "postpaid",
    host_team_id: 201,
    host_user_id: 20,
    guest_team_id: null,
    accepted_by_user_id: null,
    activity_id: null,
    holding_date: dateOffset(4, 20, 30),
    start_time: dateOffset(4, 20, 30),
    end_time: dateOffset(4, 22, 30),
    location: "驿马河二期 1 号场",
    location_latitude: 30.6428,
    location_longitude: 104.0668,
    players_per_team: 8,
    min_players: 7,
    max_players: 12,
    fee_per_person: "28",
    note: "想约一场强度中高的友谊赛，赛后可一起吃夜宵。",
    status: "open",
    accepted_at: null,
    cancelled_at: null,
    created_at: "2026-08-01 10:00:00",
    updated_at: "2026-08-01 10:00:00",
  },
  {
    id: "ch-002",
    title: "工作日晚场 6 人制",
    kind: "team",
    payment_mode: "postpaid",
    host_team_id: 202,
    host_user_id: 21,
    guest_team_id: null,
    accepted_by_user_id: null,
    activity_id: null,
    holding_date: dateOffset(6, 20, 30),
    start_time: dateOffset(6, 20, 30),
    end_time: dateOffset(6, 22, 0),
    location: "府河绿道足球场",
    location_latitude: 30.6512,
    location_longitude: 104.0432,
    players_per_team: 6,
    min_players: 5,
    max_players: 10,
    fee_per_person: "22",
    note: "偏比赛节奏，希望对手能准时到齐。",
    status: "open",
    accepted_at: null,
    cancelled_at: null,
    created_at: "2026-08-02 12:00:00",
    updated_at: "2026-08-02 12:00:00",
  },
  {
    id: "ch-003",
    title: "散人约球 · 周三晚",
    kind: "individual",
    payment_mode: "prepaid",
    host_team_id: null,
    host_user_id: 17,
    guest_team_id: null,
    accepted_by_user_id: null,
    activity_id: null,
    holding_date: dateOffset(3, 19, 45),
    start_time: dateOffset(3, 19, 45),
    end_time: dateOffset(3, 21, 30),
    location: "东湖公园 5 号场",
    location_latitude: 30.6289,
    location_longitude: 104.0795,
    players_per_team: 5,
    min_players: 5,
    max_players: 10,
    fee_per_person: "20",
    note: "散人拼场，先到先得，报名后请准时到场。",
    status: "open",
    accepted_at: null,
    cancelled_at: null,
    created_at: "2026-08-03 14:00:00",
    updated_at: "2026-08-03 14:00:00",
  },
  {
    id: "ch-004",
    title: "周末强强对话 8v8",
    kind: "team",
    payment_mode: "postpaid",
    host_team_id: 201,
    host_user_id: 20,
    guest_team_id: 101,
    accepted_by_user_id: 37,
    activity_id: "act-005",
    holding_date: dateOffset(7, 20, 0),
    start_time: dateOffset(7, 20, 0),
    end_time: dateOffset(7, 22, 0),
    location: "青龙场足球公园",
    location_latitude: 30.689,
    location_longitude: 104.101,
    players_per_team: 8,
    min_players: 7,
    max_players: 15,
    fee_per_person: "30",
    note: "已约成，期待一场精彩的比赛。",
    status: "matched",
    accepted_at: "2026-08-05 09:00:00",
    cancelled_at: null,
    created_at: "2026-07-30 10:00:00",
    updated_at: "2026-08-05 09:00:00",
  },
];

export const mockChallengeSummaries: BackendChallengeSummary[] = mockChallenges.map((challenge) => {
  const isIndividual = challenge.kind === "individual";
  const isMatched = challenge.status === "matched";

  return {
    challenge,
    host_team_name: isIndividual ? "散人约球" : challengeHostTeamName(challenge),
    host_team_credit_score: 90,
    host_team_trust_label: "稳定赴约",
    guest_team_name: isMatched ? "洺悦御府" : null,
    guest_team_credit_score: isMatched ? 94 : null,
    guest_team_trust_label: isMatched ? "稳定赴约" : null,
    current_team_relation: isMatched ? "guest" : "viewer",
    accepted_count: isIndividual ? 3 : 0,
    current_user_joined: false,
    can_accept: challenge.status === "open",
  };
});

function challengeHostTeamName(challenge: BackendChallenge): string {
  if (challenge.host_team_id === 201) return "青龙联队";
  if (challenge.host_team_id === 202) return "柏林二队";
  return "未知球队";
}

export function findMockChallengeSummary(id: string): BackendChallengeSummary | undefined {
  return mockChallengeSummaries.find((item) => item.challenge.id === id);
}

export function getMockChallengeDetail(id: string): BackendChallengeDetail | undefined {
  const summary = findMockChallengeSummary(id);
  if (!summary) return undefined;

  return {
    summary,
    activity: summary.challenge.activity_id
      ? {
          id: summary.challenge.activity_id,
          name: summary.challenge.title,
          holding_date: summary.challenge.holding_date,
          start_time: summary.challenge.start_time,
          end_time: summary.challenge.end_time,
          location: summary.challenge.location,
        }
      : null,
    individual_participants:
      summary.challenge.kind === "individual"
        ? [
            { user_id: 17, display_name: "阿强", avatar_url: "" },
            { user_id: 18, display_name: "大海", avatar_url: "" },
            { user_id: 11, display_name: "薛田正", avatar_url: "" },
          ]
        : [],
    current_user_acceptance: null,
  };
}

/** 按列表查询参数过滤约队 */
export function filterMockChallengeSummaries(params?: {
  status?: string;
  startsAfter?: string;
  limit?: number;
}): BackendChallengeSummary[] {
  let items = [...mockChallengeSummaries];

  if (params?.status) {
    items = items.filter((item) => item.challenge.status === params.status);
  }
  if (params?.startsAfter) {
    const after = params.startsAfter.replace(" ", "T");
    items = items.filter((item) => item.challenge.holding_date.replace(" ", "T") > after);
  }

  items.sort((left, right) => left.challenge.holding_date.localeCompare(right.challenge.holding_date));

  if (params?.limit) {
    items = items.slice(0, params.limit);
  }

  return items;
}
