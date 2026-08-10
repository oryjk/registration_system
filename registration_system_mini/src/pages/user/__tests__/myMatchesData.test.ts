import { expect, test } from "bun:test";
import type { AppMatchListResponse, AppMatchSummary } from "@/types/match";

const dataModule = await import("../myMatchesData").catch(() => ({}));

const baseMatch: AppMatchSummary = {
  id: "match-1",
  name: "分页比赛",
  publication_mode: "offline_confirmed",
  opponent_state: "confirmed",
  status: "ended",
  host_team_id: 11,
  host_team_name: "主队",
  away_team_id: 14,
  away_team_name: "客队",
  opponent_name: "客队",
  players_per_team: 8,
  start_time: "2026-01-10T20:00:00+08:00",
  end_time: "2026-01-10T22:00:00+08:00",
  location: "测试球场",
  location_latitude: null,
  location_longitude: null,
  description: null,
  created_at: "2026-01-01T10:00:00+08:00",
  updated_at: "2026-01-01T10:00:00+08:00",
};

test("loads every Go my-match page when total exceeds the 100-row API limit", async () => {
  const loadAllMyMatches = (
    dataModule as {
      loadAllMyMatches?: (
        fetchPage: (page: number, pageSize: number) => Promise<AppMatchListResponse>,
      ) => Promise<AppMatchSummary[]>;
    }
  ).loadAllMyMatches;
  expect(typeof loadAllMyMatches).toEqual("function");

  const calls: Array<{ page: number; pageSize: number }> = [];
  const result = await loadAllMyMatches!(async (page, pageSize) => {
    calls.push({ page, pageSize });
    const items = page === 1
      ? Array.from({ length: 100 }, (_, index) => ({ ...baseMatch, id: `match-${index + 1}` }))
      : [{ ...baseMatch, id: "match-101" }];
    return { items, total: 101, page, page_size: pageSize };
  });

  expect(calls).toEqual([
    { page: 1, pageSize: 100 },
    { page: 2, pageSize: 100 },
  ]);
  expect(result.length).toEqual(101);
  expect(result.at(-1)?.id).toEqual("match-101");
});

test("deduplicates offset-page overlap and stops at the first-page snapshot total", async () => {
  const loadAllMyMatches = (
    dataModule as {
      loadAllMyMatches?: (
        fetchPage: (page: number, pageSize: number) => Promise<AppMatchListResponse>,
      ) => Promise<AppMatchSummary[]>;
    }
  ).loadAllMyMatches;
  expect(typeof loadAllMyMatches).toEqual("function");

  const calls: number[] = [];
  const result = await loadAllMyMatches!(async (page, pageSize) => {
    calls.push(page);
    if (page === 1) {
      return {
        items: Array.from({ length: 100 }, (_, index) => ({ ...baseMatch, id: `match-${index + 1}` })),
        total: 101,
        page,
        page_size: pageSize,
      };
    }
    if (page === 2) {
      return {
        items: [
          { ...baseMatch, id: "match-100" },
          { ...baseMatch, id: "match-101" },
        ],
        total: 102,
        page,
        page_size: pageSize,
      };
    }
    throw new Error(`unexpected page ${page}`);
  });

  expect(calls).toEqual([1, 2]);
  expect(result.length).toEqual(101);
  expect(new Set(result.map((item) => item.id)).size).toEqual(101);
});

test("stops when a growing offset result produces no new unique match", async () => {
  const loadAllMyMatches = (
    dataModule as {
      loadAllMyMatches?: (
        fetchPage: (page: number, pageSize: number) => Promise<AppMatchListResponse>,
      ) => Promise<AppMatchSummary[]>;
    }
  ).loadAllMyMatches;
  expect(typeof loadAllMyMatches).toEqual("function");

  const calls: number[] = [];
  const firstPageItems = Array.from({ length: 100 }, (_, index) => ({ ...baseMatch, id: `match-${index + 1}` }));
  const result = await loadAllMyMatches!(async (page, pageSize) => {
    calls.push(page);
    if (page > 2) throw new Error(`unexpected page ${page}`);
    return {
      items: firstPageItems,
      total: page === 1 ? 101 : 500,
      page,
      page_size: pageSize,
    };
  });

  expect(calls).toEqual([1, 2]);
  expect(result.length).toEqual(100);
});
