const bunTest: any = await import("bun:test");
const { afterEach, describe, expect, mock, test } = bunTest;
const { nextTick, ref } = await import("vue");
import type { AppMatchSummary } from "@/types/match";

const registrationStartsAt = Date.parse("2026-08-20T10:00:00.000Z");
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

mock.module("@/api/match", () => ({
  listMatches: async () => ({ items: [match], total: 1, page: 1, page_size: 20 }),
}));
mock.module("@/stores/miniReview", () => ({
  useMiniReviewStatus: () => ({ shouldHideCreationEntrances: ref(false) }),
}));
mock.module("@/stores/teamContext", () => ({
  useTeamContext: () => ({
    ensureSessionReady: async () => undefined,
    currentIdentity: ref({ kind: "team", teamId: 99 }),
    currentTeam: ref({ id: 99, canManageTeam: true }),
  }),
}));
mock.module("@/utils/authStorage", () => ({ hasManualLogout: () => false }));

const { useHallPage } = await import("../useHallPage");

const originalNow = Date.now;
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;

afterEach(() => {
  Date.now = originalNow;
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
});

describe("useHallPage registration window clock", () => {
  test("updates card actions across the opening boundary and stops its timer", async () => {
    let currentTime = registrationStartsAt - 1;
    let intervalCallback: (() => void) | undefined;
    let clearedTimer: unknown;
    const timerHandle = 42 as unknown as ReturnType<typeof setInterval>;
    Date.now = () => currentTime;
    globalThis.setInterval = ((callback: TimerHandler) => {
      intervalCallback = callback as () => void;
      return timerHandle;
    }) as typeof setInterval;
    globalThis.clearInterval = ((handle: ReturnType<typeof setInterval>) => {
      clearedTimer = handle;
    }) as typeof clearInterval;

    const page = useHallPage();
    await page.loadPageData();
    expect(page.hallCards.value[0].actionKind).toEqual("view");

    page.startWindowTimer();
    currentTime = registrationStartsAt;
    intervalCallback?.();
    await nextTick();

    expect(page.hallCards.value[0].actionKind).toEqual("accept");

    page.stopWindowTimer();
    expect(clearedTimer).toBe(timerHandle);
  });
});
