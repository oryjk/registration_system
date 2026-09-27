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
      actions: ["create-team", "join-team", "browse"],
    });
  });

  test("new users can create a team, join an existing team, or find a match", () => {
    expect(resolveHomeEmptyHeroState({
      isGuest: false,
      hasTeam: false,
      canManageTeam: false,
      creationAllowed: true,
      intent: null,
    })).toEqual({
      mode: "no-team-unknown",
      actions: ["create-team", "join-team", "browse"],
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
      actions: ["create-team", "join-team"],
    });
  });

  test("player-intent users without a team can find or start a pickup match", () => {
    expect(resolveHomeEmptyHeroState({
      isGuest: false,
      hasTeam: false,
      canManageTeam: false,
      creationAllowed: true,
      intent: "player",
    })).toEqual({
      mode: "no-team-player",
      actions: ["browse", "create-pickup"],
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
      actions: ["create-match", "invite-team", "browse"],
    });

    expect(resolveHomeEmptyHeroState({
      isGuest: false,
      hasTeam: true,
      canManageTeam: false,
      creationAllowed: true,
      intent: "captain",
    })).toEqual({
      mode: "team-member",
      actions: ["browse", "view-team"],
    });
  });

  test("review mode hides creation actions while keeping the browsing path", () => {
    for (const intent of [null, "captain", "member", "player"] as const) {
      const state = resolveHomeEmptyHeroState({
        isGuest: false,
        hasTeam: false,
        canManageTeam: false,
        creationAllowed: false,
        intent,
      });
      expect(state.actions).toEqual(["join-team", "browse"]);
    }

    expect(resolveHomeEmptyHeroState({
      isGuest: false,
      hasTeam: true,
      canManageTeam: true,
      creationAllowed: false,
      intent: "captain",
    }).actions).toEqual(["invite-team", "browse"]);
  });
});

test("joining a team is a distinct reversible intention", () => {
  expect(resolveHomeEmptyHeroState({
    isGuest: false,
    hasTeam: false,
    canManageTeam: false,
    creationAllowed: true,
    intent: "member",
  })).toEqual({ mode: "no-team-member", actions: ["join-team", "browse"] });
});

test("a sole-member captain is invited to bring teammates, without blocking match creation", () => {
  expect(resolveHomeEmptyHeroState({
    isGuest: false,
    hasTeam: true,
    canManageTeam: true,
    creationAllowed: true,
    memberCount: 1,
    intent: null,
  }).actions).toEqual(["invite-team", "create-match", "browse"]);
});
