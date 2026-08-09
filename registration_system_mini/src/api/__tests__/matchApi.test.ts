const bunTest: any = await import("bun:test");
const { describe, expect, test, mock } = bunTest;

const capturedCalls: unknown[] = [];
const requestApi = async (options: unknown) => {
  capturedCalls.push(options);
  return {};
};

mock.module("@/utils/request", () => ({ requestApi }));

const { getMatchHome, listMyMatches } = await import("../match");

describe("Go match API", () => {
  test("loads the authenticated home summary", async () => {
    capturedCalls.length = 0;

    await getMatchHome();

    expect(capturedCalls[0]).toEqual({ url: "/matches/home", auth: true });
  });

  test("loads a page of the current user's matches", async () => {
    capturedCalls.length = 0;

    await listMyMatches({ page: 2, pageSize: 20 });

    expect(capturedCalls[0]).toEqual({
      url: "/matches?scope=mine&page=2&page_size=20",
      auth: true,
    });
  });

  test("mock match data is generated from the current request time", async () => {
    const originalNow = Date.now;
    try {
      Date.now = () => 1_700_000_000_000;
      const { resolveMockResponse } = await import("@/mock/handlers");

      const first = resolveMockResponse("GET", "/matches/home", null);
      if (!first) throw new Error("expected mock response");

      Date.now = () => 1_700_000_900_000;
      const second = resolveMockResponse("GET", "/matches/home", null);
      if (!second) throw new Error("expected mock response");

      const firstActionStart = (first.data as { action_items: Array<{ start_time: string }> }).action_items[0].start_time;
      const secondActionStart = (second.data as { action_items: Array<{ start_time: string }> }).action_items[0].start_time;

      expect(firstActionStart === secondActionStart).toEqual(false);
    } finally {
      Date.now = originalNow;
    }
  });

  test("mock match ids are UUID-like", async () => {
    const { resolveMockResponse } = await import("@/mock/handlers");
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const home = resolveMockResponse("GET", "/matches/home", null);
    if (!home) throw new Error("expected mock response");
    const list = resolveMockResponse("GET", "/matches?page=1&page_size=20&scope=mine", null);
    if (!list) throw new Error("expected mock response");

    const homeIds = [
      ...(home.data as { action_items: Array<{ id: string }>; ended_items: Array<{ id: string }> }).action_items.map((item) => item.id),
      ...(home.data as { action_items: Array<{ id: string }>; ended_items: Array<{ id: string }> }).ended_items.map((item) => item.id),
    ];
    const listIds = (list.data as { items: Array<{ id: string }> }).items.map((item) => item.id);

    expect(homeIds.every((id) => uuidLike.test(id))).toEqual(true);
    expect(listIds.every((id) => uuidLike.test(id))).toEqual(true);
  });
});

export {};
