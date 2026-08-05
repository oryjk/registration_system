import { buildLoginUrl, sanitizeRedirect } from "./auth-redirect";

describe("authentication redirects", () => {
  it("strips the deployed route base from an internal redirect", () => {
    expect(
      sanitizeRedirect(
        "/registration-admin/matches?status=ongoing#groups",
        "/registration-admin/",
      ),
    ).toBe("/matches?status=ongoing#groups");
  });

  it.each([
    "//evil.example.com",
    "https://evil.example.com",
    "javascript:alert(1)",
    "matches",
  ])("rejects an unsafe redirect: %s", (value) => {
    expect(sanitizeRedirect(value, "/")).toBe("/");
  });

  it("encodes the complete internal destination in the login URL", () => {
    expect(
      buildLoginUrl(
        {
          pathname: "/registration-admin/matches/42",
          search: "?tab=groups",
          hash: "#roster",
        },
        "/registration-admin/",
      ),
    ).toBe("/login?redirect=%2Fmatches%2F42%3Ftab%3Dgroups%23roster");
  });
});
