import { describe, expect, test } from "bun:test";
import type { AppMatchDetailResponse, AppMatchSummary } from "@/types/match";
import { buildGoPublicMatchDetailData, loadPublicMatchDetailData, toBackendActivity, toBackendRegistration } from "../detailData";

const goMatch: AppMatchSummary = {
  id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003",
  name: "洺悦御府对河西周四 FC",
  status: "ongoing",
  start_time: "2026-08-10T02:00:00.000Z",
  end_time: "2026-08-10T04:00:00.000Z",
  publication_mode: "offline_confirmed",
  opponent_state: "confirmed",
  host_team_id: 101,
  host_team_name: "洺悦御府",
  away_team_id: 102,
  away_team_name: "河西周四 FC",
  opponent_name: "河西周四 FC",
  players_per_team: 8,
  location: "青龙场足球公园",
  location_latitude: 30.689,
  location_longitude: 104.101,
  description: "已确认的正式比赛，双方都已到场。",
  created_at: "2026-08-05T02:00:00.000Z",
  updated_at: "2026-08-05T02:05:00.000Z",
};

describe("Go match detail adapter", () => {
  test("maps a Go match summary to the existing registration detail model", () => {
    const activity = toBackendActivity(goMatch);
    expect({
      id: activity.id,
      name: activity.name,
      status: activity.status,
      holding_date: activity.holding_date,
      start_time: activity.start_time,
      end_time: activity.end_time,
      opposing: activity.opposing,
      home_team_id: activity.home_team_id,
      away_team_id: activity.away_team_id,
      players_per_team: activity.players_per_team,
      team_capacity_limit: activity.team_capacity_limit,
      match_kind: activity.match_kind,
    }).toEqual({
      id: goMatch.id,
      name: goMatch.name,
      status: 1,
      holding_date: goMatch.start_time,
      start_time: goMatch.start_time,
      end_time: goMatch.end_time,
      opposing: goMatch.opponent_name,
      home_team_id: goMatch.host_team_id,
      away_team_id: goMatch.away_team_id,
      players_per_team: goMatch.players_per_team,
      team_capacity_limit: goMatch.players_per_team,
      match_kind: "external",
    });
  });

  test("uses the selected Go group for attendance and capacity", () => {
    const activity = toBackendActivity(goMatch, {
      id: "group-1",
      kind: "host_team",
      team_id: 101,
      status: "closed",
      min_players: 6,
      max_players: 8,
      attending_count: 7,
      my_registration: { status: "attending", registration_count: 1 },
    });

    expect({
      team_registration_count: activity.team_registration_count,
      team_capacity_limit: activity.team_capacity_limit,
    }).toEqual({ team_registration_count: 7, team_capacity_limit: 8 });
  });

  test("maps the current Go registration into the legacy participant record", () => {
    expect(toBackendRegistration(
      { status: "attending", registration_count: 1 },
      37,
      goMatch.updated_at,
    )).toEqual({
      user_id: 37,
      stand: 1,
      registration_count: 1,
      paid: 0,
      operation_time: goMatch.updated_at,
    });
  });

  test("maps attending, leave, absent, and unknown without counting non-attending statuses", () => {
    const cases = [
      ["attending", 1, true],
      ["leave", 2, false],
      ["absent", 3, false],
      ["unknown", 0, false],
    ] as const;

    for (const [status, stand, occupiesCapacity] of cases) {
      const data = buildGoPublicMatchDetailData({
        match: goMatch,
        groups: [{
          id: "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003",
          kind: "host_team",
          team_id: 101,
          status: "open",
          min_players: 0,
          max_players: 8,
          attending_count: 0,
          my_registration: { status, registration_count: 1 },
        }],
      }, 37);

      expect({
        registration: data.activityUsers[0],
        sourceTeamRegistrationCount: data.sourceTeamRegistrationCount,
        occupiesCapacity: data.activityUsers.some((item) => item.stand === 1),
      }).toEqual({
        registration: {
          user_id: 37,
          stand,
          registration_count: 1,
          paid: 0,
          operation_time: goMatch.updated_at,
        },
        sourceTeamRegistrationCount: 0,
        occupiesCapacity,
      });
    }
  });

  test("keeps the selected Go group id and a zero attending count at the lower boundary", () => {
    const data = buildGoPublicMatchDetailData({
      match: goMatch,
      groups: [{
        id: "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003",
        kind: "host_team",
        team_id: 101,
        status: "open",
        min_players: 6,
        max_players: 8,
        attending_count: 0,
        my_registration: { status: "absent", registration_count: 1 },
      }],
    }, 37);

    expect(data.goRegistrationGroupId).toEqual("a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003");
    expect(data.sourceTeamRegistrationCount).toEqual(0);
  });

  test("selects the unregistered current team's group when a match has two team groups", () => {
    const data = buildGoPublicMatchDetailData({
      match: goMatch,
      groups: [
        {
          id: "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c101",
          kind: "host_team",
          team_id: 101,
          status: "open",
          min_players: 6,
          max_players: 8,
          attending_count: 6,
          my_registration: null,
        },
        {
          id: "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c102",
          kind: "guest_team",
          team_id: 102,
          status: "open",
          min_players: 6,
          max_players: 8,
          attending_count: 5,
          my_registration: null,
        },
      ],
    }, 37, { currentTeamId: 102 });

    expect(data.goRegistrationGroupId).toEqual("a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c102");
    expect(data.activity.team_registration_count).toEqual(5);
  });

  test("prefers the action group's id over the current team fallback", () => {
    const data = buildGoPublicMatchDetailData({
      match: goMatch,
      groups: [
        {
          id: "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c201",
          kind: "host_team",
          team_id: 101,
          status: "open",
          min_players: 6,
          max_players: 8,
          attending_count: 6,
          my_registration: null,
        },
        {
          id: "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c202",
          kind: "guest_team",
          team_id: 102,
          status: "open",
          min_players: 6,
          max_players: 8,
          attending_count: 5,
          my_registration: null,
        },
      ],
    }, 37, {
      preferredGroupId: "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c202",
      currentTeamId: 101,
    });

    expect(data.goRegistrationGroupId).toEqual("a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c202");
  });

  test("selects an open individual opponent group when no team group applies", () => {
    const data = buildGoPublicMatchDetailData({
      match: goMatch,
      groups: [
        {
          id: "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c301",
          kind: "host_team",
          team_id: 101,
          status: "closed",
          min_players: 6,
          max_players: 8,
          attending_count: 8,
          my_registration: null,
        },
        {
          id: "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c302",
          kind: "individual_opponent",
          team_id: null,
          status: "open",
          min_players: 6,
          max_players: 8,
          attending_count: 4,
          my_registration: null,
        },
      ],
    }, 37);

    expect(data.goRegistrationGroupId).toEqual("a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c302");
  });

  test("selects another open group before falling back to the first group", () => {
    const data = buildGoPublicMatchDetailData({
      match: goMatch,
      groups: [
        {
          id: "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c401",
          kind: "host_team",
          team_id: 101,
          status: "closed",
          min_players: 6,
          max_players: 8,
          attending_count: 8,
          my_registration: null,
        },
        {
          id: "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c402",
          kind: "guest_team",
          team_id: 102,
          status: "open",
          min_players: 6,
          max_players: 8,
          attending_count: 4,
          my_registration: null,
        },
      ],
    }, 37);

    expect(data.goRegistrationGroupId).toEqual("a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c402");
  });

  test("loads the preferred UUID group without requesting legacy users or activities", async () => {
    const calls: string[] = [];
    const goDetail: AppMatchDetailResponse = {
      match: goMatch,
      groups: [{
        id: "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003",
        kind: "host_team",
        team_id: 101,
        status: "open",
        min_players: 6,
        max_players: 8,
        attending_count: 1,
        my_registration: null,
      }, {
        id: "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c004",
        kind: "guest_team",
        team_id: 102,
        status: "open",
        min_players: 6,
        max_players: 8,
        attending_count: 5,
        my_registration: null,
      }],
    };

    const data = await loadPublicMatchDetailData(goMatch.id, 37, {
      preferredGroupId: goDetail.groups[1].id,
      currentTeamId: 101,
    }, {
      getMatchDetail: async () => {
        calls.push("match-detail");
        return goDetail;
      },
      getActivity: async () => {
        calls.push("legacy-activity");
        throw new Error("Go detail must not request an activity");
      },
      getActivityUsers: async () => {
        calls.push("legacy-activity-users");
        throw new Error("Go detail must not request activity users");
      },
      listActivities: async () => {
        calls.push("legacy-activity-list");
        throw new Error("Go detail must not list activities");
      },
      listUsers: async () => {
        calls.push("legacy-users");
        throw new Error("Go detail must not list users");
      },
    });

    expect(calls).toEqual(["match-detail"]);
    expect({ fromGo: data.fromGo, goRegistrationGroupId: data.goRegistrationGroupId }).toEqual({
      fromGo: true,
      goRegistrationGroupId: goDetail.groups[1].id,
    });
  });
});

export {};
