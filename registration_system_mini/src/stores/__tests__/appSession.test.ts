import { describe, expect, test } from "bun:test";
import { sourcePath } from "@/test/sourcePaths";
import { resolveBootstrapStrategy, resolveSessionBootstrapMode } from "../bootstrapStrategy";

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
  test("shares the bootstrap promise between app launch bootstrap and page session readiness", async () => {
    const source = await Bun.file(sourcePath("stores/appSession.ts")).text();
    const bootstrapStart = source.indexOf("export async function ensureSessionReady");
    const refreshStart = source.indexOf("export async function refreshSessionContext");
    const bootstrapSource = source.slice(bootstrapStart, refreshStart);

    expect(bootstrapSource.includes("if (bootstrapPromise && !force)")).toEqual(true);
    expect(bootstrapSource.includes("bootstrapPromise =")).toEqual(true);
    expect(bootstrapSource.includes("bootstrapPromise = null")).toEqual(true);
  });

  test("never attempts wechat login on H5 where uni.login may never settle", async () => {
    const source = await Bun.file(sourcePath("stores/appSession.ts")).text();
    const bootstrapStart = source.indexOf("export async function ensureSessionReady");
    const refreshStart = source.indexOf("export async function refreshSessionContext");
    const bootstrapSource = source.slice(bootstrapStart, refreshStart);

    expect(bootstrapSource.includes("// #ifdef H5")).toEqual(true);
    // H5 无 token 时静默保持游客态，不能抛错把页面数据加载打成错误卡片。
    expect(bootstrapSource.includes("throw new Error(\"H5 环境不支持微信静默登录")).toEqual(false);
    const guardStart = bootstrapSource.indexOf("// #ifdef H5");
    const guardEnd = bootstrapSource.indexOf("// #endif", guardStart);
    const guardSource = bootstrapSource.slice(guardStart, guardEnd);
    expect(guardSource.includes("resetSessionState();")).toEqual(true);
    expect(guardSource.includes("return;")).toEqual(true);
    expect(guardEnd < bootstrapSource.indexOf("await loginAndBootstrap(sessionBootstrapVersion);")).toEqual(true);
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
