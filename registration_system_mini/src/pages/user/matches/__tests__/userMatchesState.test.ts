import { describe, expect, test } from "bun:test";
import type { AppMatchSummary } from "@/types/match";
import { buildUserMatchCards } from "../userMatchesState";

const baseMatch: AppMatchSummary = {
  id: "upcoming",
  name: "周末比赛",
  publication_mode: "online_team",
  opponent_state: "confirmed",
  status: "registering",
  host_team_id: 11,
  host_team_name: "主队",
  away_team_id: 14,
  away_team_name: "客队",
  opponent_name: "客队",
  players_per_team: 8,
  registration_start_at: null,
  registration_end_at: null,
  start_time: "2026-08-12T20:00:00Z",
  end_time: "2026-08-12T22:00:00Z",
  location: "驿马河二期",
  location_latitude: 30.1,
  location_longitude: 104.2,
  description: null,
  is_free: true,
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
};

describe("buildUserMatchCards", () => {
  test("maps match summaries and separates active from ended matches by resolved phase", () => {
    const matches: AppMatchSummary[] = [
      baseMatch,
      {
        ...baseMatch,
        id: "ongoing",
        name: "正在进行",
        start_time: "2026-08-10T10:00:00Z",
        end_time: "2026-08-10T14:00:00Z",
      },
      {
        ...baseMatch,
        id: "ended-by-clock",
        name: "时间已结束",
        start_time: "2026-08-09T20:00:00Z",
        end_time: "2026-08-09T22:00:00Z",
      },
      {
        ...baseMatch,
        id: "cancelled",
        status: "cancelled",
      },
    ];

    const active = buildUserMatchCards({
      matches,
      scope: "future",
      now: new Date("2026-08-10T12:00:00Z"),
    });
    const ended = buildUserMatchCards({
      matches,
      scope: "past",
      now: new Date("2026-08-10T12:00:00Z"),
    });

    expect(active.map((item) => ({ id: item.id, stage: item.stage }))).toEqual([
      { id: "ongoing", stage: "进行中" },
      { id: "upcoming", stage: "报名中" },
    ]);
    expect(active.map((item) => item.publicationModeLabel)).toEqual(["线上约队", "线上约队"]);
    expect(active.some((item) => "isEditable" in item)).toEqual(false);
    expect(ended.map((item) => ({ id: item.id, stage: item.stage }))).toEqual([
      { id: "ended-by-clock", stage: "已结束" },
    ]);
  });
});
