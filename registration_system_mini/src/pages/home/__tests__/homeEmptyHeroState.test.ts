import { describe, expect, test } from "bun:test";
import { resolveHomeEmptyHeroState } from "../homeEmptyHeroState";

describe("resolveHomeEmptyHeroState", () => {
  test("guests can browse without seeing creation actions", () => {
    expect(resolveHomeEmptyHeroState({ isGuest: true, hasTeam: false, canManageTeam: false, creationAllowed: true })).toEqual({
      audience: "guest",
      secondaryAction: null,
    });
  });

  test("users without a team can create one when creation is available", () => {
    expect(resolveHomeEmptyHeroState({ isGuest: false, hasTeam: false, canManageTeam: false, creationAllowed: true })).toEqual({
      audience: "no-team",
      secondaryAction: "create-team",
    });
  });

  test("review mode hides the creation action for users without a team", () => {
    expect(resolveHomeEmptyHeroState({ isGuest: false, hasTeam: false, canManageTeam: false, creationAllowed: false })).toEqual({
      audience: "no-team",
      secondaryAction: null,
    });
  });

  test("team managers can start a match when creation is available", () => {
    expect(resolveHomeEmptyHeroState({ isGuest: false, hasTeam: true, canManageTeam: true, creationAllowed: true })).toEqual({
      audience: "team",
      secondaryAction: "create-match",
    });
  });

  test("team members cannot see the match creation action", () => {
    expect(resolveHomeEmptyHeroState({ isGuest: false, hasTeam: true, canManageTeam: false, creationAllowed: true })).toEqual({
      audience: "team",
      secondaryAction: null,
    });
  });

  test("review mode hides match creation for team managers", () => {
    expect(resolveHomeEmptyHeroState({ isGuest: false, hasTeam: true, canManageTeam: true, creationAllowed: false })).toEqual({
      audience: "team",
      secondaryAction: null,
    });
  });
});
