import { describe, expect, test } from "bun:test";
import type { AppMatchGroupDetail, AppMatchSummary } from "@/types/match";
import { activeVenueSides, canClaimVenueSide, toVenueSideCards } from "../venueSideState";

const start = "2026-12-01T12:00:00.000Z";
const beforeStart = new Date("2026-12-01T11:00:00.000Z").getTime();
const match = {
  id: "m", status: "registering", start_time: start, players_per_team: 5, created_by_user_id: 1,
} as AppMatchSummary;

function group(overrides: Partial<AppMatchGroupDetail>): AppMatchGroupDetail {
  return {
    id: "g", kind: "individual_opponent", team_id: null, status: "open", min_players: 5, max_players: 7,
    attending_count: 0, my_registration: null, side: "a", ...overrides,
  };
}

describe("venue sides", () => {
  test("keeps active sides in a, b order", () => {
    const sides = activeVenueSides([
      group({ id: "b", side: "b" }),
      group({ id: "old", side: "a", status: "cancelled" }),
      group({ id: "a", side: "a" }),
      group({ id: "plain", side: undefined }),
    ]);
    expect(sides.map((side) => side.id)).toEqual(["a", "b"]);
  });

  test("describes empty, individual and team sides", () => {
    const cards = toVenueSideCards(match, [
      group({ id: "a", attending_count: 2 }),
      group({ id: "b", side: "b", kind: "guest_team", team_id: 9, side_team_name: "A 队", min_players: null, attending_count: 3 }),
    ], { userId: 2 }, beforeStart);
    expect(cards.map((card) => card.title)).toEqual(["散人组", "A 队"]);
    expect(cards[1].caption).toEqual("已报 3 人 · 5 人成行");
    expect(toVenueSideCards(match, [group({})], {}, beforeStart)[0].title).toEqual("虚位以待");
  });

  test("offers withdraw to the team manager and remove to the publisher before start", () => {
    const side = group({ kind: "guest_team", team_id: 9 });
    expect(toVenueSideCards(match, [side], { userId: 2, teamId: 9, canManageTeam: true }, beforeStart)[0].releaseAction).toEqual("withdraw");
    expect(toVenueSideCards(match, [side], { userId: 1 }, beforeStart)[0].releaseAction).toEqual("remove");
    expect(toVenueSideCards(match, [side], { userId: 3, teamId: 9 }, beforeStart)[0].releaseAction).toEqual(null);
    expect(toVenueSideCards(match, [side], { userId: 1 }, new Date(start).getTime())[0].releaseAction).toEqual(null);
  });

  test("only managers of an unplaced team can claim an empty side", () => {
    const manager = { teamId: 9, canManageTeam: true };
    const empty = group({});
    expect(canClaimVenueSide(match, [empty], manager, true)).toEqual(true);
    expect(canClaimVenueSide(match, [empty], { teamId: 9 }, true)).toEqual(false);
    expect(canClaimVenueSide(match, [empty], manager, false)).toEqual(false);
    expect(canClaimVenueSide(match, [group({ attending_count: 1 })], manager, true)).toEqual(false);
    expect(canClaimVenueSide(match, [group({ kind: "guest_team", team_id: 9 }), group({ id: "b", side: "b" })], manager, true)).toEqual(false);
  });
});
