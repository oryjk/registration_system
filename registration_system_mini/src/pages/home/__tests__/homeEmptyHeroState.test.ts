import { describe, expect, test } from "bun:test";
import { resolveHomeEmptyHeroState } from "../homeEmptyHeroState";

describe("resolveHomeEmptyHeroState", () => {
  test("guests can browse without being classified as a player or captain", () => {
    expect(resolveHomeEmptyHeroState({
      isGuest: true,
      hasTeam: false,
      canManageTeam: false,
      creationAllowed: true,
      intent: null,
    })).toEqual({
      mode: "guest",
      actions: ["browse"],
    });
  });

  test("new users without a known intent choose between building a team and finding a match", () => {
    expect(resolveHomeEmptyHeroState({
      isGuest: false,
      hasTeam: false,
      canManageTeam: false,
      creationAllowed: true,
      intent: null,
    })).toEqual({
      mode: "no-team-unknown",
      actions: ["create-team", "browse"],
    });
  });

  test("captain-intent users without a team are led to create their team first", () => {
    expect(resolveHomeEmptyHeroState({
      isGuest: false,
      hasTeam: false,
      canManageTeam: false,
      creationAllowed: true,
      intent: "captain",
    })).toEqual({
      mode: "no-team-captain",
      actions: ["create-team", "browse"],
    });
  });

  test("player-intent users without a team can find or start a pickup match, with team creation as a low-priority option", () => {
    expect(resolveHomeEmptyHeroState({
      isGuest: false,
      hasTeam: false,
      canManageTeam: false,
      creationAllowed: true,
      intent: "player",
    })).toEqual({
      mode: "no-team-player",
      actions: ["browse", "create-pickup", "create-team"],
    });
  });

  test("real team permissions override the stored onboarding intent", () => {
    expect(resolveHomeEmptyHeroState({
      isGuest: false,
      hasTeam: true,
      canManageTeam: true,
      creationAllowed: true,
      intent: "player",
    })).toEqual({
      mode: "team-manager",
      actions: ["create-match", "browse"],
    });

    expect(resolveHomeEmptyHeroState({
      isGuest: false,
      hasTeam: true,
      canManageTeam: false,
      creationAllowed: true,
      intent: "captain",
    })).toEqual({
      mode: "team-member",
      actions: ["browse"],
    });
  });

  test("review mode hides creation actions while keeping the browsing path", () => {
    for (const intent of [null, "captain", "player"] as const) {
      const state = resolveHomeEmptyHeroState({
        isGuest: false,
        hasTeam: false,
        canManageTeam: false,
        creationAllowed: false,
        intent,
      });
      expect(state.actions).toEqual(["browse"]);
    }

    expect(resolveHomeEmptyHeroState({
      isGuest: false,
      hasTeam: true,
      canManageTeam: true,
      creationAllowed: false,
      intent: "captain",
    }).actions).toEqual(["browse"]);
  });
});
