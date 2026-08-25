import { describe, expect, test } from "bun:test";
import type { AppMatchSummary } from "@/types/match";
import { buildOtherMatchCards } from "../otherMatchesState";

function summary(partial: Partial<AppMatchSummary>): AppMatchSummary {
  return {
    id: "m-1",
    name: "约球",
    status: "registering",
    start_time: "2026-08-26T10:00:00Z",
    end_time: "2026-08-26T12:00:00Z",
    publication_mode: "online_team",
    opponent_state: "recruiting",
    host_team_id: 7,
    host_team_name: "东安联队",
    away_team_id: null,
    away_team_name: null,
    opponent_name: null,
    players_per_team: 8,
    registration_start_at: null,
    registration_end_at: null,
    location: "东安球场",
    location_latitude: null,
    location_longitude: null,
    description: null,
    created_at: "2026-08-20T00:00:00Z",
    updated_at: "2026-08-20T00:00:00Z",
    ...partial,
  };
}

describe("buildOtherMatchCards", () => {
  const now = new Date("2026-08-25T12:00:00Z");

  test("keeps unfinished matches, drops ended and cancelled ones", () => {
    const cards = buildOtherMatchCards([
      summary({ id: "a", start_time: "2026-08-27T10:00:00Z", end_time: "2026-08-27T12:00:00Z" }),
      summary({ id: "b", status: "ended", end_time: "2026-08-24T12:00:00Z" }),
      summary({ id: "c", status: "cancelled", start_time: "2026-08-28T10:00:00Z", end_time: "2026-08-28T12:00:00Z" }),
    ], now);

    expect(cards.map((card) => card.id)).toEqual(["a"]);
  });

  test("sorts by start time ascending", () => {
    const cards = buildOtherMatchCards([
      summary({ id: "late", start_time: "2026-08-29T10:00:00Z", end_time: "2026-08-29T12:00:00Z" }),
      summary({ id: "early", start_time: "2026-08-26T10:00:00Z", end_time: "2026-08-26T12:00:00Z" }),
    ], now);

    expect(cards.map((card) => card.id)).toEqual(["early", "late"]);
  });
});
