import { describe, expect, test } from "bun:test";
import { sourcePath } from "@/test/sourcePaths";
import { resolveBootstrapStrategy, resolveSessionBootstrapMode, resolveStoredSessionStrategy } from "../bootstrapStrategy";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("resolveBootstrapStrategy", () => {
  test("reuses existing token during forced refresh instead of falling back to wechat login", () => {
    expect(resolveBootstrapStrategy(true)).toEqual("existing_token");
  });

  test("requests wechat login only when no token is present", () => {
    expect(resolveBootstrapStrategy(false)).toEqual("wechat_login");
  });
});

describe("resolveStoredSessionStrategy", () => {
  test("restores an existing token during app launch", () => {
    expect(resolveStoredSessionStrategy({ hasAccessToken: true, isManuallyLoggedOut: false })).toEqual("existing_token");
  });

  test("keeps app launch in guest mode when no token exists", () => {
    expect(resolveStoredSessionStrategy({ hasAccessToken: false, isManuallyLoggedOut: false })).toEqual("guest");
  });

  test("does not restore a stored token after manual logout", () => {
    expect(resolveStoredSessionStrategy({ hasAccessToken: true, isManuallyLoggedOut: true })).toEqual("guest");
  });
});

describe("resolveSessionBootstrapMode", () => {
  test("blocks auto bootstrap after a manual logout until forced refresh", () => {
    expect(
      resolveSessionBootstrapMode({
        hasAccessToken: false,
        isManuallyLoggedOut: true,
      }),
    ).toEqual("blocked_by_logout");
  });

  test("allows an explicit refresh to re-enter the wechat login flow after logout", () => {
    expect(
      resolveSessionBootstrapMode({
        hasAccessToken: false,
        isManuallyLoggedOut: true,
        force: true,
      }),
    ).toEqual("wechat_login");
  });
});

describe("app session bootstrap request coalescing", () => {
  test("shares the bootstrap promise between app launch restore and page session readiness", async () => {
    const source = await Bun.file(sourcePath("stores/appSession.ts")).text();
    const restoreStart = source.indexOf("export async function restoreSessionFromStorage()");
    const clearSessionStart = source.indexOf("export function clearSession()");
    const restoreSource = source.slice(restoreStart, clearSessionStart);

    expect(restoreSource.includes("if (bootstrapPromise)")).toEqual(true);
    expect(restoreSource.includes("bootstrapPromise =")).toEqual(true);
    expect(restoreSource.includes("bootstrapPromise = null")).toEqual(true);
  });

  test("does not load full team details during session bootstrap", async () => {
    const source = await Bun.file(sourcePath("stores/appSession.ts")).text();
    const loadTeamContextStart = source.indexOf("async function loadTeamContext()");
    const ensureTeamDetailLoadedStart = source.indexOf("async function ensureTeamDetailLoaded");
    const loadTeamContextSource = source.slice(loadTeamContextStart, ensureTeamDetailLoadedStart);

    expect(loadTeamContextSource.includes("const teams = await getMyTeams();")).toEqual(true);
    expect(loadTeamContextSource.includes("getTeamDetail(")).toEqual(false);
    expect(source.includes("async function ensureTeamDetailLoaded")).toEqual(true);
  });
});
