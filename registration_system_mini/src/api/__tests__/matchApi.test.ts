const bunTest: any = await import("bun:test");
const { describe, expect, test, mock } = bunTest;

const capturedCalls: unknown[] = [];
const requestApi = async (options: unknown) => {
  capturedCalls.push(options);
  return {};
};
class MockApiRequestError extends Error {}

mock.module("@/utils/request", () => ({ ApiRequestError: MockApiRequestError, requestApi }));

const { cancelMyMatchRegistration, createMatch, getMatchDetail, getMatchHome, listMatches, listMyMatches, putMyMatchRegistration, updateMatchStatus } = await import("../match");
const { tryMockRequest } = await import("@/mock");

describe("Match API", () => {
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

  test("searches the current user's matches with a five-item page", async () => {
    capturedCalls.length = 0;

    await listMyMatches({ page: 1, pageSize: 5, search: " 驿马河 " });

    expect(capturedCalls[0]).toEqual({
      url: "/matches?scope=mine&search=%E9%A9%BF%E9%A9%AC%E6%B2%B3&page=1&page_size=5",
      auth: true,
    });
  });

  test("loads unrelated not-yet-started matches with scope=others and starts_after", async () => {
    capturedCalls.length = 0;

    // 后端 start_time 存 UTC 时刻，Date 入参序列化为 UTC ISO（toISOString）。
    await listMatches({ scope: "others", startsAfter: new Date("2026-08-09T12:00:00.000Z"), page: 1, pageSize: 20 });

    expect(capturedCalls[0]).toEqual({
      url: "/matches?scope=others&starts_after=2026-08-09T12%3A00%3A00.000Z&page=1&page_size=20",
      auth: true,
    });
  });

  test("accepts a raw RFC3339 starts_after string without reformatting", async () => {
    capturedCalls.length = 0;

    await listMatches({ scope: "others", startsAfter: "2026-08-09T12:00:00+08:00", page: 3, pageSize: 10 });

    expect(capturedCalls[0]).toEqual({
      url: "/matches?scope=others&starts_after=2026-08-09T12%3A00%3A00%2B08%3A00&page=3&page_size=10",
      auth: true,
    });
  });

  test("omits starts_after when not provided", async () => {
    capturedCalls.length = 0;

    await listMatches({ scope: "mine", page: 1, pageSize: 20 });

    expect(capturedCalls[0]).toEqual({
      url: "/matches?scope=mine&page=1&page_size=20",
      auth: true,
    });
  });

  test("loads the authenticated match detail", async () => {
    capturedCalls.length = 0;

    await getMatchDetail("f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003");
    expect(capturedCalls[0]).toEqual({
      url: "/matches/f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003",
      auth: true,
    });
  });

  test("creates a match with match time fields and the selected host team", async () => {
    capturedCalls.length = 0;

    await createMatch({
      name: "周末友谊赛",
      publication_mode: "offline_confirmed",
      host_team_id: 7,
      opponent_name: "周末对手",
      players_per_team: 8,
      start_time: "2026-08-20T10:00:00.000Z",
      end_time: "2026-08-20T12:00:00.000Z",
      location: "东安球场",
    });

    expect(capturedCalls[0]).toEqual({
      url: "/matches",
      method: "POST",
      data: {
        name: "周末友谊赛",
        publication_mode: "offline_confirmed",
        host_team_id: 7,
        opponent_name: "周末对手",
        players_per_team: 8,
        start_time: "2026-08-20T10:00:00.000Z",
        end_time: "2026-08-20T12:00:00.000Z",
        location: "东安球场",
      },
      auth: true,
    });
  });

  test("writes attending and leave status to the selected match group", async () => {
    capturedCalls.length = 0;

    await putMyMatchRegistration("f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003", "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003", "attending");
    await putMyMatchRegistration("f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003", "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003", "leave");
    await putMyMatchRegistration("f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003", "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003", "attending", 3);

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
      {
        url: "/matches/f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003/groups/a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003/my-registration",
        method: "PUT",
        data: { status: "attending", registration_count: 3 },
        auth: true,
      },
    ]);
  });

  test("cancels the selected match group registration", async () => {
    capturedCalls.length = 0;

    await cancelMyMatchRegistration("f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003", "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003");

    expect(capturedCalls[0]).toEqual({
      url: "/matches/f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003/groups/a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003/my-registration",
      method: "DELETE",
      auth: true,
    });
  });

  test("finishes a match by patching its status", async () => {
    capturedCalls.length = 0;

    await updateMatchStatus("f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c005", "ended");
    await updateMatchStatus("f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c005", "cancelled");

    expect(capturedCalls).toEqual([
      {
        url: "/matches/f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c005/status",
        method: "PATCH",
        data: { status: "ended" },
        auth: true,
      },
      {
        url: "/matches/f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c005/status",
        method: "PATCH",
        data: { status: "cancelled" },
        auth: true,
      },
    ]);
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

  test("mock /matches/home returns related action and ended collections with actual-time classification", async () => {
    const { resolveMockResponse } = await import("@/mock/handlers");
    const home = resolveMockResponse("GET", "/matches/home", null);
    if (!home) throw new Error("expected mock response");

    const data = home.data as {
      action_items: Array<{ id: string; group: unknown }>;
      action_has_more: boolean;
      ended_items: Array<{ id: string }>;
      ended_has_more: boolean;
    };

    expect(Array.isArray(data.action_items)).toEqual(true);
    expect(typeof data.action_has_more).toEqual("boolean");
    expect(typeof data.ended_has_more).toEqual("boolean");
    const actionIds = new Set(data.action_items.map((item) => item.id));
    const endedIds = new Set(data.ended_items.map((item) => item.id));
    expect(actionIds.has("f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c004")).toEqual(true);
    expect(actionIds.has("f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c006")).toEqual(false);
    expect(endedIds.has("f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c006")).toEqual(true);
    expect("upcoming_items" in data).toEqual(false);
  });

  test("mock /matches supports scope=others and starts_after filtering", async () => {
    const { resolveMockResponse } = await import("@/mock/handlers");

    const others = resolveMockResponse("GET", "/matches?scope=others&page=1&page_size=20", null);
    if (!others) throw new Error("expected mock response");
    const othersItems = (others.data as { items: Array<{ id: string; host_team_name: string; start_time: string }> }).items;
    expect(othersItems.length).toEqual(5);
    expect(othersItems.some((item) => item.host_team_name === "洺悦御府" || item.host_team_name === "河西周四 FC")).toEqual(false);

    const nowIso = new Date().toISOString();
    const filtered = resolveMockResponse("GET", `/matches?scope=others&starts_after=${encodeURIComponent(nowIso)}&page=1&page_size=20`, null);
    if (!filtered) throw new Error("expected mock response");
    const filteredItems = (filtered.data as { items: Array<{ id: string; start_time: string }> }).items;
    // 已经开始的「麓山联队主场进行时」被 starts_after 过滤掉
    expect(filteredItems.length).toEqual(4);
    expect(filteredItems.every((item) => Date.parse(item.start_time) > Date.parse(nowIso))).toEqual(true);
    expect(filteredItems.some((item) => item.id === "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c015")).toEqual(false);

    const mine = resolveMockResponse("GET", "/matches?scope=mine&page=1&page_size=20", null);
    if (!mine) throw new Error("expected mock response");
    const mineItems = (mine.data as { items: Array<{ id: string }> }).items;
    expect(mineItems.some((item) => item.id === "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c011")).toEqual(false);
  });

  test("mock /matches searches name or location before paginating", async () => {
    const { resolveMockResponse } = await import("@/mock/handlers");
    const response = resolveMockResponse(
      "GET",
      `/matches?scope=mine&search=${encodeURIComponent("驿马河")}&page=1&page_size=5`,
      null,
    );
    if (!response) throw new Error("expected mock response");

    const data = response.data as {
      items: Array<{ name: string; location: string; start_time: string }>;
      total: number;
      page_size: number;
    };
    expect(data.page_size).toEqual(5);
    expect(data.items.length <= 5).toEqual(true);
    expect(data.items.length).toEqual(data.total);
    expect(data.items.every((item) => `${item.name} ${item.location}`.includes("驿马河"))).toEqual(true);
    expect(data.items.map((item) => item.start_time)).toEqual(
      [...data.items].map((item) => item.start_time).sort().reverse(),
    );
  });

  test("mock handlers cover registration writes", async () => {
    const { resolveMockResponse } = await import("@/mock/handlers");
    const matchId = "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c001";
    const detailResponse = resolveMockResponse("GET", `/matches/${matchId}`, null);
    const detail = detailResponse?.data as { groups: Array<{ id: string }> };
    const response = resolveMockResponse(
      "PUT",
      `/matches/${matchId}/groups/${detail.groups[0].id}/my-registration`,
      { status: "attending", registration_count: 1 },
    );

    expect(response?.data).toMatchObject({
      group_id: detail.groups[0].id,
      status: "attending",
      registration_count: 1,
    });
  });

  test("mock match creation persists the new match into home and mine", async () => {
    const { resolveMockResponse } = await import("@/mock/handlers");
    const response = resolveMockResponse("POST", "/matches", {
      name: "Mock 新建比赛",
      publication_mode: "online_team",
      host_team_id: 101,
      opponent_name: "测试对手",
      players_per_team: 8,
      start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      location: "Mock 球场",
    });

    if (!response) throw new Error("expected mock response");
    const created = response.data as { match: { id: string; name: string }; groups: Array<{ id: string }> };
    expect(created.match.name).toEqual("Mock 新建比赛");
    expect(created.groups.length).toEqual(1);

    const home = resolveMockResponse("GET", "/matches/home", null);
    const mine = resolveMockResponse("GET", "/matches?scope=mine&page=1&page_size=50", null);
    if (!home || !mine) throw new Error("expected mock collections");
    expect((home.data as { action_items: Array<{ id: string }> }).action_items.some((item) => item.id === created.match.id)).toEqual(true);
    expect((mine.data as { items: Array<{ id: string }> }).items.some((item) => item.id === created.match.id)).toEqual(true);
  });

  test("mock match creation preserves registration bounds", async () => {
    const { resolveMockResponse } = await import("@/mock/handlers");
    const response = resolveMockResponse("POST", "/matches", {
      name: "带报名窗口的比赛",
      publication_mode: "online_team",
      host_team_id: 101,
      players_per_team: 8,
      start_time: "2026-08-20T12:00:00.000Z",
      end_time: "2026-08-20T14:00:00.000Z",
      registration_start_at: "2026-08-18T08:00:00.000Z",
      registration_end_at: "2026-08-20T10:00:00.000Z",
      location: "Mock 球场",
    });

    expect((response?.data as { match: { registration_start_at: string; registration_end_at: string } }).match).toMatchObject({
      registration_start_at: "2026-08-18T08:00:00.000Z",
      registration_end_at: "2026-08-20T10:00:00.000Z",
    });
  });

  test("mock rejects registration and team application before the window opens", async () => {
    const { resolveMockResponse } = await import("@/mock/handlers");
    const response = resolveMockResponse("POST", "/matches", {
      name: "尚未开放的比赛",
      publication_mode: "online_team",
      host_team_id: 101,
      players_per_team: 8,
      start_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      registration_start_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      registration_end_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      location: "Mock 球场",
    });
    const created = response?.data as { match: { id: string }; groups: Array<{ id: string }> };

    expect(() => resolveMockResponse(
      "PUT",
      `/matches/${created.match.id}/groups/${created.groups[0].id}/my-registration`,
      { status: "attending", registration_count: 1 },
    )).toThrow("当前不在报名时间内");
    expect(() => resolveMockResponse(
      "POST",
      `/matches/${created.match.id}/team-applications`,
      { team_id: 202, introduction: "测试球队" },
    )).toThrow("当前不在报名时间内");
  });

  test("mock evaluates one registration request with a single clock reading", async () => {
    const originalNow = Date.now;
    const baseNow = 1_850_000_000_000;
    try {
      Date.now = () => baseNow;
      const { resolveMockResponse } = await import("@/mock/handlers");
      const response = resolveMockResponse("POST", "/matches", {
        name: "截止边界单时钟比赛",
        publication_mode: "online_team",
        host_team_id: 101,
        players_per_team: 8,
        start_time: new Date(baseNow + 2 * 60 * 60 * 1000).toISOString(),
        end_time: new Date(baseNow + 4 * 60 * 60 * 1000).toISOString(),
        registration_start_at: new Date(baseNow - 60 * 60 * 1000).toISOString(),
        registration_end_at: new Date(baseNow + 1_000).toISOString(),
        location: "Mock 球场",
      });
      const created = response?.data as { match: { id: string }; groups: Array<{ id: string }> };
      let clockReads = 0;
      Date.now = () => {
        clockReads += 1;
        return baseNow + (clockReads === 1 ? 999 : 1_000);
      };

      const registration = resolveMockResponse(
        "PUT",
        `/matches/${created.match.id}/groups/${created.groups[0].id}/my-registration`,
        { status: "attending", registration_count: 1 },
      );

      expect(registration?.data).toMatchObject({ status: "attending" });
      expect(clockReads).toEqual(1);
    } finally {
      Date.now = originalNow;
    }
  });

  test("mock allows selected opponent rollback after the registration deadline", async () => {
    const originalNow = Date.now;
    const baseNow = 1_800_000_000_000;
    try {
      Date.now = () => baseNow;
      const { resolveMockResponse } = await import("@/mock/handlers");
      const response = resolveMockResponse("POST", "/matches", {
        name: "已选对手回滚比赛",
        publication_mode: "online_team",
        host_team_id: 101,
        players_per_team: 8,
        start_time: new Date(baseNow + 2 * 60 * 60 * 1000).toISOString(),
        end_time: new Date(baseNow + 4 * 60 * 60 * 1000).toISOString(),
        registration_start_at: new Date(baseNow - 60 * 60 * 1000).toISOString(),
        registration_end_at: new Date(baseNow + 60 * 60 * 1000).toISOString(),
        location: "Mock 球场",
      });
      const matchId = (response?.data as { match: { id: string } }).match.id;
      const applicationResponse = resolveMockResponse(
        "POST",
        `/matches/${matchId}/team-applications`,
        { team_id: 202, introduction: "测试球队" },
      );
      const applicationId = (applicationResponse?.data as { id: string }).id;
      resolveMockResponse("POST", `/matches/${matchId}/team-applications/${applicationId}/select`, null);

      Date.now = () => baseNow + 60 * 60 * 1000;
      const withdrawn = resolveMockResponse(
        "POST",
        `/matches/${matchId}/team-applications/${applicationId}/withdraw`,
        null,
      );

      expect(withdrawn?.data).toMatchObject({ id: applicationId, status: "withdrawn" });
    } finally {
      Date.now = originalNow;
    }
  });

  test("mock allows the host manager to finish an expired match once", async () => {
    const { resolveMockResponse } = await import("@/mock/handlers");
    const matchId = "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c005";

    expect(() => resolveMockResponse("PATCH", `/matches/${matchId}/status`, { status: "registering" })).toThrow(
      "收尾状态只能是已结束或已取消",
    );

    const response = resolveMockResponse("PATCH", `/matches/${matchId}/status`, { status: "ended" });
    expect((response?.data as { match: { status: string } }).match.status).toEqual("ended");

    const detail = resolveMockResponse("GET", `/matches/${matchId}`, null);
    expect((detail?.data as { match: { status: string } }).match.status).toEqual("ended");

    expect(() => resolveMockResponse("PATCH", `/matches/${matchId}/status`, { status: "cancelled" })).toThrow(
      "比赛已结束或已取消，不能再次变更",
    );
  });

  test("mock rejects finishing a match before its end time", async () => {
    const { resolveMockResponse } = await import("@/mock/handlers");
    const response = resolveMockResponse("POST", "/matches", {
      name: "尚未结束的收尾比赛",
      publication_mode: "online_team",
      host_team_id: 101,
      players_per_team: 8,
      start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      location: "Mock 球场",
    });
    const matchId = (response?.data as { match: { id: string } }).match.id;

    expect(() => resolveMockResponse("PATCH", `/matches/${matchId}/status`, { status: "ended" })).toThrow(
      "比赛尚未到结束时间，暂不能收尾",
    );
  });

  test("normalizes the full app base path before routing mock requests", async () => {
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
