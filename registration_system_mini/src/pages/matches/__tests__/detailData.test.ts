import { describe, expect, test } from "bun:test";
import type { AppMatchSummary } from "@/types/match";
import { toBackendActivity } from "../detailData";

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
});

export {};
