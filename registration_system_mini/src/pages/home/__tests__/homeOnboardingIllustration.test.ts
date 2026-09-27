import { describe, expect, test } from "bun:test";
import { resolveHomeOnboardingIllustration } from "../homeOnboardingIllustration";
import type { HomeEmptyHeroMode } from "../homeEmptyHeroState";

const images = { welcome: "welcome.png", team: "team.png", match: "match.png" };
describe("home onboarding illustration selection", () => {
  test("matches each task without changing the existing social-image slot", () => {
    for (const [mode, expected] of [
      ["guest", images.welcome], ["no-team-unknown", images.welcome],
      ["no-team-captain", images.team], ["no-team-member", images.team],
      ["no-team-player", images.match], ["team-member", images.match],
    ] as [HomeEmptyHeroMode, string][]) {
      expect(resolveHomeOnboardingIllustration({ mode, actions: [] }, images, "social.png")).toEqual(expected);
    }
    expect(resolveHomeOnboardingIllustration({ mode: "team-manager", actions: ["invite-team"] }, images, "social.png")).toEqual(images.team);
    expect(resolveHomeOnboardingIllustration({ mode: "team-manager", actions: ["create-match"] }, images, "social.png")).toEqual("social.png");
  });
  test("clearing a scene selects the built-in fallback instead of another scene", () => {
    expect(resolveHomeOnboardingIllustration({ mode: "no-team-member", actions: [] }, { ...images, team: "" }, "social.png")).toEqual("");
  });
});
