const bunTest: any = await import("bun:test");
const { describe, expect, test, mock } = bunTest;

const capturedCalls: unknown[] = [];
const requestApi = async (options: unknown) => {
  capturedCalls.push(options);
  return {};
};
class MockApiRequestError extends Error {}

mock.module("@/utils/request", () => ({ ApiRequestError: MockApiRequestError, requestApi }));

const { cancelMyMatchRegistration, getMatchDetail, getMatchHome, listMyMatches, putMyMatchRegistration } = await import("../match");
const { tryMockRequest } = await import("@/mock");

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

  test("loads the authenticated Go match detail", async () => {
    capturedCalls.length = 0;

    await getMatchDetail("f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003");
    expect(capturedCalls[0]).toEqual({
      url: "/matches/f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003",
      auth: true,
    });
  });

  test("writes attending and leave status to the selected Go match group", async () => {
    capturedCalls.length = 0;

    await putMyMatchRegistration("f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003", "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003", "attending");
    await putMyMatchRegistration("f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003", "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003", "leave");

    expect(capturedCalls).toEqual([
      {
        url: "/matches/f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003/groups/a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003/my-registration",
        method: "PUT",
        data: { status: "attending", registration_count: 1 },
        auth: true,
      },
      {
        url: "/matches/f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003/groups/a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003/my-registration",
        method: "PUT",
        data: { status: "leave", registration_count: 1 },
        auth: true,
      },
    ]);
  });

  test("cancels the selected Go match group registration", async () => {
    capturedCalls.length = 0;

    await cancelMyMatchRegistration("f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003", "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003");

    expect(capturedCalls[0]).toEqual({
      url: "/matches/f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003/groups/a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003/my-registration",
      method: "DELETE",
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

  test("mock handlers cover Go registration writes", async () => {
    const { resolveMockResponse } = await import("@/mock/handlers");
    const response = resolveMockResponse(
      "PUT",
      "/matches/f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003/groups/a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003/my-registration",
      { status: "attending", registration_count: 1 },
    );

    expect(response?.data).toMatchObject({
      group_id: "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003",
      status: "attending",
      registration_count: 1,
    });
  });

  test("normalizes the full Go app base path before routing mock requests", async () => {
    const loginResponse = await tryMockRequest(
      "POST",
      "http://127.0.0.1:18080/api/v1/app/test-auth/login",
      { user_id: 1 },
    );
    const homeResponse = await tryMockRequest(
      "GET",
      "http://127.0.0.1:18080/api/v1/app/matches/home",
    );

    expect(loginResponse).not.toBeNull();
    expect(homeResponse).not.toBeNull();
  });
});

export {};
