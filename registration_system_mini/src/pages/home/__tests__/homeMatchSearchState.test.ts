import { describe, expect, test } from "bun:test";
import type { AppMatchSummary } from "@/types/match";
import {
  HOME_MATCH_SEARCH_PAGE_SIZE,
  mergeHomeMatchSearchPage,
  resolveHomeMatchSearchLoadMoreIntent,
  shouldAutoLoadHomeMatchSearchPage,
  toHomeMatchSearchCard,
} from "../homeMatchSearchState";

function buildMatch(overrides: Partial<AppMatchSummary>): AppMatchSummary {
  return {
    id: "match-default",
    name: "周末友谊赛",
    publication_mode: "offline_confirmed",
    opponent_state: "confirmed",
    status: "registering",
    host_team_id: 1,
    host_team_name: "银河联队",
    away_team_id: null,
    away_team_name: null,
    opponent_name: null,
    players_per_team: 8,
    start_time: "2026-08-12T20:00:00Z",
    end_time: "2026-08-12T22:00:00Z",
    location: "驿马河二期",
    location_latitude: null,
    location_longitude: null,
    description: null,
    registration_groups: [],
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T10:00:00Z",
    ...overrides,
  };
}

describe("mergeHomeMatchSearchPage", () => {
  test("uses five items per page and reports that another page is available", () => {
    expect(HOME_MATCH_SEARCH_PAGE_SIZE).toEqual(5);

    const result = mergeHomeMatchSearchPage([], {
      items: [1, 2, 3, 4, 5].map((id) => buildMatch({ id: String(id) })),
      total: 6,
      page: 1,
      page_size: 5,
    });

    expect(result.matches.map((match) => match.id)).toEqual(["1", "2", "3", "4", "5"]);
    expect(result.page).toEqual(1);
    expect(result.total).toEqual(6);
    expect(result.hasMore).toEqual(true);
  });

  test("appends the next page in server order, removes duplicate ids, and stops at total", () => {
    const result = mergeHomeMatchSearchPage(
      [buildMatch({ id: "newest" }), buildMatch({ id: "middle" })],
      {
        items: [buildMatch({ id: "middle" }), buildMatch({ id: "oldest" })],
        total: 4,
        page: 2,
        page_size: 2,
      },
    );

    expect(result.matches.map((match) => match.id)).toEqual(["newest", "middle", "oldest"]);
    expect(result.hasMore).toEqual(false);
  });

  test("stops when the server returns an empty page", () => {
    const result = mergeHomeMatchSearchPage([buildMatch({ id: "one" })], {
      items: [],
      total: 10,
      page: 2,
      page_size: 5,
    });

    expect(result.hasMore).toEqual(false);
  });
});

describe("resolveHomeMatchSearchLoadMoreIntent", () => {
  test("ignores a fast reach-bottom event while the current page is loading", () => {
    expect(resolveHomeMatchSearchLoadMoreIntent({
      hasActiveSearch: true,
      isGuestMode: false,
      isLoading: true,
      hasMore: false,
    })).toEqual("ignore");
    expect(resolveHomeMatchSearchLoadMoreIntent({
      hasActiveSearch: true,
      isGuestMode: false,
      isLoading: true,
      hasMore: true,
    })).toEqual("ignore");
  });

  test("loads immediately only when an active search has another page", () => {
    expect(resolveHomeMatchSearchLoadMoreIntent({
      hasActiveSearch: true,
      isGuestMode: false,
      isLoading: false,
      hasMore: true,
    })).toEqual("load");
    expect(resolveHomeMatchSearchLoadMoreIntent({
      hasActiveSearch: true,
      isGuestMode: false,
      isLoading: false,
      hasMore: false,
    })).toEqual("ignore");
    expect(resolveHomeMatchSearchLoadMoreIntent({
      hasActiveSearch: false,
      isGuestMode: false,
      isLoading: true,
      hasMore: true,
    })).toEqual("ignore");
  });
});

describe("shouldAutoLoadHomeMatchSearchPage", () => {
  test("requests another page when the footer remains visible after a fast scroll", () => {
    expect(shouldAutoLoadHomeMatchSearchPage({
      intersectionRatio: 0.2,
      hasMore: true,
      isLoading: false,
      hasError: false,
    })).toEqual(true);
  });

  test("waits until the current request finishes before loading again", () => {
    expect(shouldAutoLoadHomeMatchSearchPage({
      intersectionRatio: 0.2,
      hasMore: true,
      isLoading: true,
      hasError: false,
    })).toEqual(false);
    expect(shouldAutoLoadHomeMatchSearchPage({
      intersectionRatio: 0,
      hasMore: true,
      isLoading: false,
      hasError: false,
    })).toEqual(false);
  });
});

describe("toHomeMatchSearchCard", () => {
  test("keeps cancelled matches visible with an explicit cancelled stage", () => {
    const card = toHomeMatchSearchCard(
      buildMatch({ id: "cancelled", status: "cancelled", name: "已取消比赛" }),
      new Date("2026-08-01T12:00:00Z"),
    );

    expect(card.stage).toEqual("已取消");
    expect(card.stageTone).toEqual("red");
    expect(card.canOpenDetail).toEqual(true);
    expect(card.canRegister).toEqual(false);
  });
});
