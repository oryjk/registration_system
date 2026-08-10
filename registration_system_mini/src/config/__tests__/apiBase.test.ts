import { describe, expect, test } from "bun:test";
import { buildAppApiUrl, normalizeAppApiBase } from "../apiBase";

describe("app API base URL", () => {
  test("normalizes the complete Go app API root", () => {
    expect(normalizeAppApiBase("http://127.0.0.1:18080/api/v1/app/")).toEqual("http://127.0.0.1:18080/api/v1/app");
  });

  test("accepts a reverse-proxy prefix before the Go app API root", () => {
    expect(normalizeAppApiBase("https://oryjk.cn:82/regist-v3/api/v1/app/")).toEqual(
      "https://oryjk.cn:82/regist-v3/api/v1/app",
    );
  });

  test("rejects a base URL without the app API root", () => {
    let didThrow = false;
    try {
      normalizeAppApiBase("http://127.0.0.1:18080/api");
    } catch (_error) {
      didThrow = true;
    }
    expect(didThrow).toEqual(true);
  });

  test("builds URLs only from domain-relative paths", () => {
    expect(buildAppApiUrl("http://api.example.test/api/v1/app", "/users/me")).toEqual(
      "http://api.example.test/api/v1/app/users/me",
    );
    let didThrow = false;
    try {
      buildAppApiUrl("http://api.example.test/api/v1/app", "/api/v1/app/users/me");
    } catch (_error) {
      didThrow = true;
    }
    expect(didThrow).toEqual(true);
  });
});
