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
});

export {};
