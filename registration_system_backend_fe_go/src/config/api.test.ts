import { buildApiUrl } from "./api";

describe("buildApiUrl", () => {
  it("builds a same-origin admin URL", () => {
    expect(buildApiUrl("", "required", "/matches")).toBe(
      "/api/v1/admin/matches",
    );
  });

  it("builds a proxied login URL without duplicate slashes", () => {
    expect(buildApiUrl("/go-api/", "login", "/auth/login")).toBe(
      "/go-api/api/v1/admin/auth/login",
    );
  });

  it("keeps health checks outside the admin prefix", () => {
    expect(buildApiUrl("https://api.example.com/", "none", "/health")).toBe(
      "https://api.example.com/health",
    );
  });

  it("rejects callers that repeat the admin prefix", () => {
    expect(() =>
      buildApiUrl("", "required", "/api/v1/admin/matches"),
    ).toThrow();
  });

  it("rejects paths that do not start with a slash", () => {
    expect(() => buildApiUrl("", "required", "matches")).toThrow();
  });

  it("rejects admin paths even when authorization is disabled", () => {
    expect(() => buildApiUrl("", "none", "/api/v1/admin/matches")).toThrow();
  });
});
