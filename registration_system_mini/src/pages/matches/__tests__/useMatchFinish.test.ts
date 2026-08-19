import { describe, expect, test } from "bun:test";
import type { AppMatchSummary } from "@/types/match";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { resolveMatchCancelState, resolveMatchFinishState } from "../useMatchFinish";

function buildSourceMatch(overrides: Partial<AppMatchSummary> = {}): AppMatchSummary {
  return {
    id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c005",
    name: "洺悦御府历史补赛",
    status: "ongoing",
    start_time: "2026-08-01T18:00:00.000Z",
    end_time: "2026-08-01T20:00:00.000Z",
    publication_mode: "online_individual",
    opponent_state: "confirmed",
    host_team_id: 7,
    host_team_name: "洺悦御府",
    away_team_id: null,
    away_team_name: null,
    opponent_name: "老朋友 FC",
    players_per_team: 5,
    registration_start_at: null,
    registration_end_at: null,
    location: "东湖公园 5 号场",
    location_latitude: null,
    location_longitude: null,
    description: null,
    created_at: "2026-07-22T10:00:00.000Z",
    updated_at: "2026-07-22T10:00:00.000Z",
    ...overrides,
  };
}

function buildTeam(overrides: Partial<TeamProfileViewModel> = {}): TeamProfileViewModel {
  return {
    id: 7,
    name: "洺悦御府",
    description: "",
    logoUrl: "",
    status: 1,
    memberCount: 12,
    myRole: "captain",
    myRoleLabel: "队长",
    joinedAt: "",
    isCaptain: true,
    canManageTeam: true,
    creditScore: 90,
    trustLabel: "",
    vipUntil: "",
    isVip: false,
    ...overrides,
  };
}

const AFTER_END = Date.parse("2026-08-01T20:00:01.000Z");
const BEFORE_END = Date.parse("2026-08-01T19:00:00.000Z");

describe("resolveMatchFinishState", () => {
  test("allows the host team manager after the end time", () => {
    expect(resolveMatchFinishState({
      sourceMatch: buildSourceMatch(),
      currentTeam: buildTeam(),
      now: AFTER_END,
    })).toEqual({ canFinish: true });
  });

  test("allows a registering match that never moved to ongoing", () => {
    expect(resolveMatchFinishState({
      sourceMatch: buildSourceMatch({ status: "registering" }),
      currentTeam: buildTeam(),
      now: AFTER_END,
    })).toEqual({ canFinish: true });
  });

  test("allows the away team manager for a confirmed online team match", () => {
    expect(resolveMatchFinishState({
      sourceMatch: buildSourceMatch({
        publication_mode: "online_team",
        opponent_state: "confirmed",
        away_team_id: 9,
        away_team_name: "河西周四 FC",
      }),
      currentTeam: buildTeam({ id: 9 }),
      now: AFTER_END,
    })).toEqual({ canFinish: true });
  });

  test("rejects the away team manager before the opponent is confirmed", () => {
    expect(resolveMatchFinishState({
      sourceMatch: buildSourceMatch({ publication_mode: "online_team", away_team_id: null }),
      currentTeam: buildTeam({ id: 9 }),
      now: AFTER_END,
    })).toEqual({ canFinish: false });
  });

  test("rejects the away team manager for non online team matches", () => {
    expect(resolveMatchFinishState({
      sourceMatch: buildSourceMatch({
        publication_mode: "offline_confirmed",
        away_team_id: 9,
      }),
      currentTeam: buildTeam({ id: 9 }),
      now: AFTER_END,
    })).toEqual({ canFinish: false });
  });

  test("rejects when the match has not reached its end time", () => {
    expect(resolveMatchFinishState({
      sourceMatch: buildSourceMatch(),
      currentTeam: buildTeam(),
      now: BEFORE_END,
    })).toEqual({ canFinish: false });
  });

  test("rejects terminal match statuses", () => {
    for (const status of ["ended", "cancelled"] as const) {
      expect(resolveMatchFinishState({
        sourceMatch: buildSourceMatch({ status }),
        currentTeam: buildTeam(),
        now: AFTER_END,
      })).toEqual({ canFinish: false });
    }
  });

  test("rejects members without team management rights", () => {
    expect(resolveMatchFinishState({
      sourceMatch: buildSourceMatch(),
      currentTeam: buildTeam({ canManageTeam: false, isCaptain: false, myRole: "member" }),
      now: AFTER_END,
    })).toEqual({ canFinish: false });
  });

  test("rejects the team leader even though they can manage the team", () => {
    expect(resolveMatchFinishState({
      sourceMatch: buildSourceMatch(),
      currentTeam: buildTeam({ canManageTeam: true, isCaptain: false, myRole: "leader" }),
      now: AFTER_END,
    })).toEqual({ canFinish: false });
    expect(resolveMatchFinishState({
      sourceMatch: buildSourceMatch({
        publication_mode: "online_team",
        opponent_state: "confirmed",
        away_team_id: 9,
      }),
      currentTeam: buildTeam({ id: 9, canManageTeam: true, isCaptain: false, myRole: "leader" }),
      now: AFTER_END,
    })).toEqual({ canFinish: false });
  });

  test("rejects a manager from an unrelated team", () => {
    expect(resolveMatchFinishState({
      sourceMatch: buildSourceMatch(),
      currentTeam: buildTeam({ id: 99 }),
      now: AFTER_END,
    })).toEqual({ canFinish: false });
  });

  test("rejects missing match or team context", () => {
    expect(resolveMatchFinishState({ sourceMatch: null, currentTeam: buildTeam(), now: AFTER_END })).toEqual({ canFinish: false });
    expect(resolveMatchFinishState({ sourceMatch: buildSourceMatch(), currentTeam: null, now: AFTER_END })).toEqual({ canFinish: false });
  });
});

describe("resolveMatchCancelState", () => {
  test("allows the host captain to cancel before the end time", () => {
    expect(resolveMatchCancelState({
      sourceMatch: buildSourceMatch(),
      currentTeam: buildTeam(),
      now: BEFORE_END,
    })).toEqual({ canCancel: true });
  });

  test("allows the pickup match creator without a team", () => {
    expect(resolveMatchCancelState({
      sourceMatch: buildSourceMatch({
        publication_mode: "online_pickup",
        host_team_id: null,
        created_by_user_id: 42,
      }),
      currentTeam: null,
      now: BEFORE_END,
      currentUserId: 42,
    })).toEqual({ canCancel: true });
  });

  test("rejects other pickup participants who did not create the match", () => {
    expect(resolveMatchCancelState({
      sourceMatch: buildSourceMatch({
        publication_mode: "online_pickup",
        host_team_id: null,
        created_by_user_id: 42,
      }),
      currentTeam: null,
      now: BEFORE_END,
      currentUserId: 99,
    })).toEqual({ canCancel: false });
  });

  test("rejects prepaid matches entirely", () => {
    expect(resolveMatchCancelState({
      sourceMatch: buildSourceMatch({ payment_mode: "prepaid" }),
      currentTeam: buildTeam(),
      now: BEFORE_END,
    })).toEqual({ canCancel: false });
  });

  test("rejects after the end time where the finish dialog takes over", () => {
    expect(resolveMatchCancelState({
      sourceMatch: buildSourceMatch(),
      currentTeam: buildTeam(),
      now: AFTER_END,
    })).toEqual({ canCancel: false });
  });

  test("rejects terminal statuses and non-owners", () => {
    expect(resolveMatchCancelState({
      sourceMatch: buildSourceMatch({ status: "cancelled" }),
      currentTeam: buildTeam(),
      now: BEFORE_END,
    })).toEqual({ canCancel: false });
    expect(resolveMatchCancelState({
      sourceMatch: buildSourceMatch(),
      currentTeam: buildTeam({ id: 99 }),
      now: BEFORE_END,
    })).toEqual({ canCancel: false });
  });
});
