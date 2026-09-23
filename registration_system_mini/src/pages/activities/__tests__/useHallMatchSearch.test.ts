import { describe, expect, test } from "bun:test";
import { ref } from "vue";
import type { AppMatchSummary, AppMatchListResponse } from "@/types/match";
import type { ListMatchesParams } from "@/api/match";
import { useHallMatchSearch } from "../useHallMatchSearch";

const match: AppMatchSummary = {
  id: "match-window-boundary",
  name: "报名边界测试赛",
  status: "registering",
  publication_mode: "online_team",
  opponent_state: "recruiting",
  host_team_id: 7,
  host_team_name: "主队",
  away_team_id: null,
  away_team_name: null,
  opponent_name: null,
  players_per_team: 8,
  start_time: "2026-08-20T12:00:00.000Z",
  end_time: "2026-08-20T14:00:00.000Z",
  registration_start_at: "2026-08-20T10:00:00.000Z",
  registration_end_at: "2026-08-20T11:00:00.000Z",
  location: "测试球场",
  location_latitude: null,
  location_longitude: null,
  description: null,
  registration_groups: [],
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
};

const response = (items: AppMatchSummary[], page = 1, total = items.length): AppMatchListResponse => ({ items, page, page_size: 10, total });
const item = (id: string, status: AppMatchSummary["status"] = "registering") => ({ ...match, id, status });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe("hall search union", () => {
  test("combines hall and unrestricted personal history, deduplicating shared matches", async () => {
    const calls: ListMatchesParams[] = [];
    const state = useHallMatchSearch(ref(false), async params => {
      calls.push(params);
      return response(params.scope === "all" ? [item("shared")] : [item("shared"), item("ended", "ended"), item("cancelled", "cancelled")]);
    });
    state.searchQuery.value = " 球场 ";
    await state.handleSearch();
    expect(calls.map(p => [p.scope, p.search, p.status, !!p.startsAfter, p.publicationModes])).toEqual([
      ["all", "球场", "registering", true, ["online_team", "online_individual", "online_pickup"]],
      ["mine", "球场", undefined, false, undefined],
    ]);
    expect(state.searchMatches.value.map(m => m.id)).toEqual(["cancelled", "ended", "shared"]);
    expect(state.searchMatches.value[0].status).toEqual("cancelled");
    expect(state.searchHasMore.value).toEqual(false);
  });

  test("paginates each scope independently and ignores concurrent load requests", async () => {
    const calls: string[] = [];
    const second = deferred<AppMatchListResponse>();
    const state = useHallMatchSearch(ref(false), async p => {
      calls.push(`${p.scope}:${p.page}`);
      if (p.page === 2) return second.promise;
      return response([item(p.scope)], 1, p.scope === "mine" ? 11 : 1);
    });
    state.searchQuery.value = "球场";
    await state.handleSearch();
    const loading = state.loadMoreSearchResults();
    await state.loadMoreSearchResults();
    expect(calls).toEqual(["all:1", "mine:1", "mine:2"]);
    second.resolve(response([item("last")], 2, 11));
    await loading;
    expect(state.searchHasMore.value).toEqual(false);
    expect(state.searchMatches.value.length).toEqual(3);
  });

  test("ignores stale results after a new keyword and after clearing", async () => {
    const old = deferred<AppMatchListResponse>();
    const state = useHallMatchSearch(ref(false), async p => p.search === "旧" ? old.promise : response([item("new")]));
    state.searchQuery.value = "旧";
    const oldSearch = state.handleSearch();
    state.searchQuery.value = "新";
    await state.handleSearch();
    old.resolve(response([item("old")]));
    await oldSearch;
    expect(state.searchMatches.value.map(m => m.id)).toEqual(["new"]);
    state.searchQuery.value = "旧";
    const clearingSearch = state.handleSearch();
    state.clearSearchResults();
    await clearingSearch;
    expect([state.hasSearched.value, state.searchMatches.value.length, state.isSearching.value]).toEqual([false, 0, false]);
  });

  test("retries the same pages after one source fails without losing or duplicating matches", async () => {
    let fail = true;
    const calls: string[] = [];
    const state = useHallMatchSearch(ref(false), async p => {
      calls.push(`${p.scope}:${p.page}`);
      if (p.scope === "mine" && fail) throw new Error("暂时失败");
      return response([item(p.scope)]);
    });
    state.searchQuery.value = "球场";
    await state.handleSearch();
    expect(state.searchErrorMessage.value).toEqual("暂时失败");
    fail = false;
    await state.loadMoreSearchResults();
    expect(calls).toEqual(["all:1", "mine:1", "all:1", "mine:1"]);
    expect(state.searchMatches.value.length).toEqual(2);
    expect(state.searchErrorMessage.value).toEqual("");
  });
});
