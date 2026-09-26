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

const endedMatch: AppMatchSummary = {
  ...match,
  id: "ended-reference-match",
  name: "上周五人制夜场",
  status: "ended",
  start_time: "2026-08-10T12:00:00.000Z",
  end_time: "2026-08-10T14:00:00.000Z",
};

const hideCreationEntrancesRef = ref(false);
const identityRef = ref<{ kind: string; teamId: number } | null>({ kind: "team", teamId: 99 });
let sessionRequests = 0;
let matchRequests = 0;
let registeringItems: AppMatchSummary[] = [match];
let endedItems: AppMatchSummary[] = [endedMatch];
let pendingEndedResponse: Promise<{ items: AppMatchSummary[]; total: number }> | null = null;
const matchScopes: string[] = [];
const matchStatuses: Array<string | undefined> = [];
const matchPageSizes: number[] = [];
let currentToken = "token-a";

mock.module("@/api/match", () => ({
  listMatches: async (params: { scope: string; status?: string; pageSize: number }) => {
    matchRequests += 1;
    matchScopes.push(params.scope);
    matchStatuses.push(params.status);
    matchPageSizes.push(params.pageSize);
    if (params.status === "ended" && pendingEndedResponse) {
      const pending = pendingEndedResponse;
      pendingEndedResponse = null;
      return pending;
    }
    const items = params.status === "ended" ? endedItems : registeringItems;
    return { items, total: items.length, page: 1, page_size: params.pageSize };
  },
}));
mock.module("@/stores/miniReview", () => ({
  useMiniReviewStatus: () => ({ shouldHideCreationEntrances: hideCreationEntrancesRef }),
}));
mock.module("@/stores/teamContext", () => ({
  useTeamContext: () => ({
    ensureSessionReady: async () => { sessionRequests += 1; },
    currentIdentity: identityRef,
    currentTeam: ref({ id: 99, canManageTeam: true, isCaptain: true }),
  }),
}));
mock.module("@/utils/authStorage", () => ({
  hasManualLogout: () => false,
  getAccessToken: () => currentToken,
}));

const { useHallPage } = await import("../useHallPage");

const originalNow = Date.now;
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;

afterEach(() => {
  Date.now = originalNow;
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
  hideCreationEntrancesRef.value = false;
  identityRef.value = { kind: "team", teamId: 99 };
  sessionRequests = 0;
  matchRequests = 0;
  registeringItems = [match];
  endedItems = [endedMatch];
  pendingEndedResponse = null;
  matchScopes.length = 0;
  matchStatuses.length = 0;
  matchPageSizes.length = 0;
  currentToken = "token-a";
});

test("date changes reuse session data but fetch matches; token changes and explicit refresh recheck session", async () => {
  const page = useHallPage();
  await page.loadPageData();
  expect([sessionRequests, matchRequests]).toEqual([1, 1]);

  page.selectDate("2026-09-24");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect([sessionRequests, matchRequests]).toEqual([1, 2]);

  currentToken = "token-b";
  page.selectDate("2026-09-25");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect([sessionRequests, matchRequests]).toEqual([2, 3]);

  await page.loadPageData();
  expect([sessionRequests, matchRequests]).toEqual([3, 4]);
});

test("loads recent ended public matches only when the unfiltered hall is truly empty", async () => {
  registeringItems = [];
  const page = useHallPage();

  await page.loadPageData();

  expect(matchRequests).toEqual(2);
  expect(matchScopes).toEqual(["all", "all"]);
  expect(matchStatuses).toEqual(["registering", "ended"]);
  expect(matchPageSizes).toEqual([20, 3]);
  expect(page.hallCards.value.length).toEqual(0);
  expect(page.endedReferenceCards.value.length).toEqual(1);
  expect(page.endedReferenceCards.value[0].title).toEqual("上周五人制夜场");
  expect(page.endedReferenceCards.value[0].phase).toEqual("ended");
  expect(page.endedReferenceCards.value[0].actionLabel).toEqual("查看比赛");
});

test("does not fetch ended references when a current hall match exists", async () => {
  const page = useHallPage();

  await page.loadPageData();

  expect(matchRequests).toEqual(1);
  expect(matchStatuses).toEqual(["registering"]);
  expect(page.endedReferenceCards.value).toEqual([]);
});

test("an outdated ended-reference failure cannot erase a newer successful refresh", async () => {
  registeringItems = [];
  let rejectOld!: (error: Error) => void;
  pendingEndedResponse = new Promise((_resolve, reject) => { rejectOld = reject; });
  const page = useHallPage();
  const oldLoad = page.loadPageData();
  while (matchRequests < 2) await Promise.resolve();

  await page.loadPageData();
  expect(page.endedReferenceCards.value.map((card) => card.id)).toEqual([endedMatch.id]);

  rejectOld(new Error("old request timed out"));
  await oldLoad;
  expect(page.endedReferenceCards.value.map((card) => card.id)).toEqual([endedMatch.id]);
  expect(page.errorMessage.value).toEqual("");
});

test("kind and size filters stay local while every date fetch uses all scope", async () => {
  const page = useHallPage();
  await page.loadPageData();
  page.selectKind("mine");
  page.selectSize(5);
  page.selectKind("team");
  page.selectKind("individual");
  expect(matchScopes).toEqual(["all"]);

  page.selectKind("mine");
  page.selectDate("2026-09-24");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(matchScopes).toEqual(["all", "all"]);
  expect(sessionRequests).toEqual(1);
});

test("resetHallFilters clears date, kind and size and reloads when a date had narrowed the server query", async () => {
  const page = useHallPage();
  await page.loadPageData();

  page.selectKind("team");
  page.selectSize(8);
  page.selectDate("2026-09-24");
  await new Promise((resolve) => setTimeout(resolve, 0));

  page.resetHallFilters();
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(page.activeKind.value).toEqual("all");
  expect(page.activeSize.value).toEqual(0);
  expect(page.selectedDateKey.value).toEqual("");
  expect(matchRequests).toEqual(3);
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

describe("useHallPage publish sheet gating", () => {
  test("散人（无球队/场馆身份）也能打开发布面板，但没有球队发布身份", async () => {
    identityRef.value = null;
    const page = useHallPage();
    await nextTick();

    expect(page.canOpenPublishSheet.value).toEqual(true);
    expect(page.hasPublishIdentity.value).toEqual(false);
  });

  test("有球队身份时两种判定都通过", async () => {
    const page = useHallPage();
    await nextTick();

    expect(page.canOpenPublishSheet.value).toEqual(true);
    expect(page.hasPublishIdentity.value).toEqual(true);
  });

  test("审核隐藏期发布面板不可打开", async () => {
    hideCreationEntrancesRef.value = true;
    const page = useHallPage();
    await nextTick();

    expect(page.canOpenPublishSheet.value).toEqual(false);
  });
});
