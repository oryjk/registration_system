import { describe, expect, test } from "bun:test";
import type { AppMatchSummary } from "@/types/match";
import type { MineOverviewState } from "../mineOverviewState";

const overviewModule = await import("../mineOverviewState").catch(() => ({}));

const baseMatch: AppMatchSummary = {
  id: "match-upcoming",
  name: "周末友谊赛",
  publication_mode: "offline_confirmed",
  opponent_state: "confirmed",
  status: "registering",
  host_team_id: 11,
  host_team_name: "洺悦御府",
  away_team_id: 14,
  away_team_name: "来访球队",
  opponent_name: "来访球队",
  players_per_team: 8,
  start_time: "2026-08-12T20:00:00Z",
  end_time: "2026-08-12T22:00:00Z",
  location: "驿马河二期",
  location_latitude: null,
  location_longitude: null,
  description: null,
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
};

function buildOverview(matches: AppMatchSummary[], now: Date) {
  const buildMineOverviewState = (
    overviewModule as {
      buildMineOverviewState?: (matches: AppMatchSummary[], wallet: Record<string, number>, now: Date) => unknown;
    }
  ).buildMineOverviewState;
  expect(typeof buildMineOverviewState).toEqual("function");

  return buildMineOverviewState!(
    matches,
    {
      user_id: 37,
      balance_cents: 12345,
      total_recharged_cents: 20000,
      total_spent_cents: 6789,
      version: 1,
    },
    now,
  ) as MineOverviewState;
}

describe("buildMineOverviewState", () => {
  test("maps RFC3339 Go matches and wallet cents into the mine overview", () => {
    const state = buildOverview(
      [
        baseMatch,
        {
          ...baseMatch,
          id: "match-past",
          name: "年初比赛",
          status: "ended",
          start_time: "2026-01-10T20:00:00Z",
          end_time: "2026-01-10T22:00:00Z",
        },
      ],
      new Date("2026-08-10T12:00:00Z"),
    );

    expect(state).toEqual({
      activityCount: 2,
      totalHoursLabel: "4 h",
      matches: [
        {
          id: "match-upcoming",
          title: "周末友谊赛",
          dateLabel: "08/12 20:00",
          venue: "驿马河二期",
          statusLabel: "报名中",
          actionLabel: "查看比赛",
        },
      ],
      walletSummary: {
        balanceLabel: "¥123.45",
        totalExpenseLabel: "¥67.89",
        latestExpenseLabel: "进入账单查看",
      },
    });
  });

  test("uses the current clock for phase selection and actual match durations", () => {
    const state = buildOverview(
      [
        {
          ...baseMatch,
          id: "already-started",
          name: "今天已开赛",
          start_time: "2026-08-10T10:00:00Z",
          end_time: "2026-08-10T13:30:00Z",
        },
        {
          ...baseMatch,
          id: "future-short",
          name: "未来短赛",
          start_time: "2026-08-11T20:00:00Z",
          end_time: "2026-08-11T21:30:00Z",
        },
        {
          ...baseMatch,
          id: "cancelled",
          status: "cancelled",
          start_time: "2026-08-12T20:00:00Z",
          end_time: "2026-08-12T22:00:00Z",
        },
        {
          ...baseMatch,
          id: "early-ongoing",
          status: "ongoing",
          start_time: "2026-08-11T18:00:00Z",
          end_time: "2026-08-11T20:00:00Z",
        },
      ],
      new Date("2026-08-10T12:00:00Z"),
    );

    expect(state.activityCount).toEqual(3);
    expect(state.totalHoursLabel).toEqual("7 h");
    expect(state.matches).toEqual([
      {
        id: "future-short",
        title: "未来短赛",
        dateLabel: "08/11 20:00",
        venue: "驿马河二期",
        statusLabel: "报名中",
        actionLabel: "查看比赛",
      },
    ]);
  });

  test("falls back to two hours when migrated match duration is implausibly long", () => {
    const state = buildOverview(
      [
        {
          ...baseMatch,
          id: "normal-match",
          start_time: "2026-08-10T10:00:00Z",
          end_time: "2026-08-10T13:30:00Z",
        },
        {
          ...baseMatch,
          id: "migrated-long-match",
          start_time: "2026-08-09T10:00:00Z",
          end_time: "2026-08-15T10:00:00Z",
        },
      ],
      new Date("2026-08-10T12:00:00Z"),
    );

    expect(state.totalHoursLabel).toEqual("5.5 h");
  });
});
