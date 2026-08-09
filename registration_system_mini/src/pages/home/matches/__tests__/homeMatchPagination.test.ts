import { describe, expect, test } from "bun:test";
import type { AppMatchListResponse, AppMatchSummary } from "@/types/match";
import { loadNextVisiblePhaseBatch, type HomeMatchPaginationState } from "../homeMatchPagination";

const now = new Date("2026-08-09T12:00:00.000Z");

const baseMatch: AppMatchSummary = {
  id: "base-match",
  status: "registering",
  start_time: "2026-08-09T13:00:00.000Z",
  end_time: "2026-08-09T14:00:00.000Z",
  name: "基础比赛",
  publication_mode: "online_team",
  opponent_state: "no_recruitment",
  host_team_id: 1,
  host_team_name: "银河联队",
  away_team_id: null,
  away_team_name: null,
  opponent_name: "红星队",
  players_per_team: 8,
  location: "A 场",
  location_latitude: null,
  location_longitude: null,
  description: null,
  created_at: "2026-08-09T10:00:00.000Z",
  updated_at: "2026-08-09T11:00:00.000Z",
};

function buildMatch(overrides: Partial<AppMatchSummary>): AppMatchSummary {
  return {
    ...baseMatch,
    ...overrides,
  };
}

function buildPage(items: AppMatchSummary[], page: number): AppMatchListResponse {
  return {
    items,
    total: 3,
    page,
    page_size: 2,
  };
}

describe("loadNextVisiblePhaseBatch", () => {
  test("scans across empty filtered pages until the target phase becomes visible and keeps the latest duplicate row", async () => {
    const page1 = buildPage(
      [
        buildMatch({
          id: "upcoming-only",
          status: "registering",
          name: "报名中 1",
          start_time: "2026-08-09T13:00:00.000Z",
          end_time: "2026-08-09T15:00:00.000Z",
        }),
        buildMatch({
          id: "shared-match",
          status: "registering",
          name: "共享比赛（报名中）",
          start_time: "2026-08-09T13:30:00.000Z",
          end_time: "2026-08-09T15:30:00.000Z",
        }),
      ],
      1,
    );
    const page2 = buildPage(
      [
        buildMatch({
          id: "shared-match",
          status: "cancelled",
          name: "共享比赛（已取消）",
          start_time: "2026-08-09T13:30:00.000Z",
          end_time: "2026-08-09T15:30:00.000Z",
        }),
      ],
      2,
    );
    const page3 = buildPage(
      [
        buildMatch({
          id: "shared-match",
          status: "ended",
          name: "共享比赛（已结束）",
          start_time: "2026-08-09T09:30:00.000Z",
          end_time: "2026-08-09T11:30:00.000Z",
        }),
        buildMatch({
          id: "ended-only",
          status: "ended",
          name: "已结束 2",
          start_time: "2026-08-09T08:30:00.000Z",
          end_time: "2026-08-09T10:30:00.000Z",
        }),
      ],
      3,
    );

    const calls: Array<{ page: number; pageSize: number }> = [];
    const fetchPage = async (page: number, pageSize: number) => {
      calls.push({ page, pageSize });
      if (page === 1) return page1;
      if (page === 2) return page2;
      if (page === 3) return page3;
      throw new Error(`unexpected page ${page}`);
    };

    const initialState: HomeMatchPaginationState = {
      sourceItems: [],
      nextPage: 1,
      total: 0,
      pageSize: 2,
    };

    const loadedState = await loadNextVisiblePhaseBatch(initialState, "ended", now, fetchPage);

    expect(calls).toEqual([
      { page: 1, pageSize: 2 },
      { page: 2, pageSize: 2 },
      { page: 3, pageSize: 2 },
    ]);
    expect(loadedState.sourceItems.length).toEqual(3);
    expect(new Set(loadedState.sourceItems.map((item) => item.id)).size).toEqual(3);
    expect(loadedState.sourceItems.find((item) => item.id === "shared-match")?.name).toEqual("共享比赛（已结束）");
    expect(loadedState.sourceItems.find((item) => item.id === "shared-match")?.status).toEqual("ended");
    expect(loadedState.nextPage).toEqual(4);
    expect(loadedState.total).toEqual(3);

    const terminalCalls: Array<{ page: number; pageSize: number }> = [];
    const terminalState = await loadNextVisiblePhaseBatch(loadedState, "ended", now, async (page, pageSize) => {
      terminalCalls.push({ page, pageSize });
      throw new Error("should not fetch after source rows are consumed");
    });

    expect(terminalCalls).toEqual([]);
    expect(terminalState).toEqual(loadedState);
  });

  test("treats an empty first response as terminal and does not fetch again", async () => {
    const calls: Array<{ page: number; pageSize: number }> = [];
    const fetchPage = async (page: number, pageSize: number) => {
      calls.push({ page, pageSize });
      return {
        items: [],
        total: 0,
        page,
        page_size: pageSize,
      };
    };

    const initialState: HomeMatchPaginationState = {
      sourceItems: [],
      nextPage: 1,
      total: 0,
      pageSize: 2,
    };

    const loadedState = await loadNextVisiblePhaseBatch(initialState, "upcoming", now, fetchPage);

    expect(calls).toEqual([{ page: 1, pageSize: 2 }]);
    expect(loadedState.total).toEqual(0);
    expect(loadedState.nextPage).toEqual(2);
    expect(loadedState.sourceItems).toEqual([]);

    const terminalCalls: Array<{ page: number; pageSize: number }> = [];
    const terminalState = await loadNextVisiblePhaseBatch(loadedState, "upcoming", now, async (page, pageSize) => {
      terminalCalls.push({ page, pageSize });
      throw new Error("should not fetch after empty-first response");
    });

    expect(terminalCalls).toEqual([]);
    expect(terminalState).toEqual(loadedState);
  });

  test("stops when the latest total shrinks to the unique source row count", async () => {
    const initialState: HomeMatchPaginationState = {
      sourceItems: [
        buildMatch({
          id: "upcoming-a",
          status: "registering",
          name: "报名中 A",
          start_time: "2026-08-09T13:00:00.000Z",
          end_time: "2026-08-09T15:00:00.000Z",
        }),
        buildMatch({
          id: "upcoming-b",
          status: "registering",
          name: "报名中 B",
          start_time: "2026-08-09T13:30:00.000Z",
          end_time: "2026-08-09T15:30:00.000Z",
        }),
      ],
      nextPage: 2,
      total: 10,
      pageSize: 2,
    };

    const calls: Array<{ page: number; pageSize: number }> = [];
    const fetchPage = async (page: number, pageSize: number) => {
      calls.push({ page, pageSize });
      if (page === 2) {
        return {
          items: [
            buildMatch({
              id: "cancelled-a",
              status: "cancelled",
              name: "已取消 A",
              start_time: "2026-08-09T09:00:00.000Z",
              end_time: "2026-08-09T10:00:00.000Z",
            }),
          ],
          total: 3,
          page,
          page_size: pageSize,
        };
      }
      throw new Error(`unexpected page ${page}`);
    };

    const loadedState = await loadNextVisiblePhaseBatch(initialState, "ended", now, fetchPage);

    expect(calls).toEqual([{ page: 2, pageSize: 2 }]);
    expect(loadedState.total).toEqual(3);
    expect(loadedState.sourceItems.length).toEqual(3);
    expect(new Set(loadedState.sourceItems.map((item) => item.id)).size).toEqual(3);
    expect(loadedState.nextPage).toEqual(3);

    const terminalCalls: Array<{ page: number; pageSize: number }> = [];
    const terminalState = await loadNextVisiblePhaseBatch(loadedState, "ended", now, async (page, pageSize) => {
      terminalCalls.push({ page, pageSize });
      throw new Error("should not fetch after total shrink converges");
    });

    expect(terminalCalls).toEqual([]);
    expect(terminalState).toEqual(loadedState);
  });

  test("treats an empty page after loaded rows as terminal", async () => {
    const initialState: HomeMatchPaginationState = {
      sourceItems: [
        buildMatch({
          id: "upcoming-a",
          status: "registering",
          name: "报名中 A",
          start_time: "2026-08-09T13:00:00.000Z",
          end_time: "2026-08-09T15:00:00.000Z",
        }),
      ],
      nextPage: 2,
      total: 10,
      pageSize: 2,
    };

    const calls: Array<{ page: number; pageSize: number }> = [];
    const fetchPage = async (page: number, pageSize: number) => {
      calls.push({ page, pageSize });
      if (page === 2) {
        return {
          items: [],
          total: 10,
          page,
          page_size: pageSize,
        };
      }
      throw new Error(`unexpected page ${page}`);
    };

    const loadedState = await loadNextVisiblePhaseBatch(initialState, "upcoming", now, fetchPage);

    expect(calls).toEqual([{ page: 2, pageSize: 2 }]);
    expect(loadedState.total).toEqual(1);
    expect(loadedState.sourceItems.length).toEqual(1);
    expect(loadedState.nextPage).toEqual(3);

    const terminalCalls: Array<{ page: number; pageSize: number }> = [];
    const terminalState = await loadNextVisiblePhaseBatch(loadedState, "upcoming", now, async (page, pageSize) => {
      terminalCalls.push({ page, pageSize });
      throw new Error("should not fetch after empty-after-loaded response");
    });

    expect(terminalCalls).toEqual([]);
    expect(terminalState).toEqual(loadedState);
  });
});
