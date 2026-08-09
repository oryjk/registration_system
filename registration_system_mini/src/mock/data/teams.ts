import type { BackendTeam, BackendTeamDetail, BackendTeamMember } from "@/types/backend";

/**
 * Mock 球队数据。
 *
 * 当前用户（id=37 王睿）是洺悦御府队长，同时也是河西周四 FC 的普通队员。
 * 球队成员与 mock 用户（data/users.ts）对应。
 */
export const TEAM_ID_MINGYUE = 101;
export const TEAM_ID_HEXI = 102;

export const mockTeams: BackendTeam[] = [
  {
    id: TEAM_ID_MINGYUE,
    name: "洺悦御府",
    description: "洺悦御府业主足球队",
    logo_url: "",
    captain_id: 37,
    status: 1,
    credit_score: 94,
    vip_until: null,
    trust_label: "稳定赴约",
    is_vip: false,
    member_count: 15,
    my_role: "captain",
  },
  {
    id: TEAM_ID_HEXI,
    name: "河西周四 FC",
    description: "河西周四夜场固定班底",
    logo_url: "",
    captain_id: 1,
    status: 1,
    credit_score: 88,
    vip_until: null,
    trust_label: "评价稳定",
    is_vip: false,
    member_count: 18,
    my_role: "member",
  },
];

function buildMembers(
  teamId: number,
  captainId: number,
  memberIds: number[],
  joinedAtByUserId: Record<number, string> = {},
): BackendTeamMember[] {
  const all = [captainId, ...memberIds];
  return all.map((userId, index) => ({
    user_id: userId,
    role: userId === captainId ? "captain" : "member",
    jersey_number: String(index + 1),
    is_member: true,
    joined_at: joinedAtByUserId[userId] ?? "2025-01-01 00:00:00",
    status: 1,
  }));
}

const mingyueMembers = buildMembers(
  TEAM_ID_MINGYUE,
  37,
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  { 37: "2024-03-16 00:00:00" },
);
const hexiMembers = buildMembers(
  TEAM_ID_HEXI,
  1,
  [37, 14, 15, 16, 2, 3, 4],
  { 37: "2026-04-18 00:00:00" },
);

export const mockTeamDetails: Record<number, BackendTeamDetail> = {
  [TEAM_ID_MINGYUE]: { team: mockTeams[0], members: mingyueMembers },
  [TEAM_ID_HEXI]: { team: mockTeams[1], members: hexiMembers },
};

export function findMockTeam(teamId: number): BackendTeamDetail | undefined {
  return mockTeamDetails[teamId];
}

export function findMockTeamSummary(teamId: number): BackendTeam | undefined {
  return mockTeams.find((item) => item.id === teamId);
}
