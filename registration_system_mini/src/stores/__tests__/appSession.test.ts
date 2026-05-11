import { describe, expect, test } from "bun:test";
import { resolveBootstrapStrategy, resolveSessionBootstrapMode } from "../bootstrapStrategy";

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
