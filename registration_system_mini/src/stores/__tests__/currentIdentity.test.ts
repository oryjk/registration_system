import { describe, expect, test } from "bun:test";
import { buildAvailableIdentities, findCurrentIdentity, resolveCurrentIdentitySelection } from "@/stores/currentIdentity";
import type { BackendUser } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";

function user(overrides?: Partial<BackendUser>): BackendUser {
  return {
    id: 100,
    open_id: "openid",
    username: "user100",
    nickname: "老王",
    real_name: "东安球馆",
    avatar_url: "",
    phone_number: "",
    is_manager: false,
    is_venue: false,
    ...overrides,
  };
}

function team(overrides: Partial<TeamProfileViewModel>): TeamProfileViewModel {
  return {
    id: 1,
    name: "东安洛悦联队",
    description: "",
    logoUrl: "",
    status: 1,
    memberCount: 12,
    myRole: "member",
    myRoleLabel: "队员",
    joinedAt: "2026-05-01 10:00:00",
    isCaptain: false,
    canManageTeam: false,
    creditScore: 100,
    trustLabel: "信用良好",
    vipUntil: "",
    isVip: false,
    ...overrides,
  };
}

describe("current identity", () => {
  test("builds publish identities from manageable teams and venue user flag", () => {
    const identities = buildAvailableIdentities(user({ is_venue: true }), [
      team({ id: 1, name: "普通队", canManageTeam: false }),
      team({ id: 2, name: "队长队", myRoleLabel: "队长", canManageTeam: true }),
    ]);

    expect(identities.map((identity) => identity.id)).toEqual(["team:2", "venue"]);
    expect(identities[0].label).toEqual("队长队");
    expect(identities[0].roleLabel).toEqual("队长");
    expect(identities[1].label).toEqual("东安球馆");
    expect(identities[1].roleLabel).toEqual("场馆");
  });

  test("keeps a stored venue identity when user is both captain and venue", () => {
    const identities = buildAvailableIdentities(user({ is_venue: true }), [
      team({ id: 8, canManageTeam: true }),
    ]);

    const selection = resolveCurrentIdentitySelection({ kind: "venue" }, identities, 8);
    const identity = findCurrentIdentity(selection, identities);

    expect(selection).toEqual({ kind: "venue" });
    expect(identity?.kind).toEqual("venue");
  });

  test("falls back to the current manageable team when stored identity is invalid", () => {
    const identities = buildAvailableIdentities(user({ is_venue: true }), [
      team({ id: 5, name: "五号队", canManageTeam: true }),
      team({ id: 8, name: "八号队", canManageTeam: true }),
    ]);

    const selection = resolveCurrentIdentitySelection({ kind: "team", teamId: 404 }, identities, 8);
    const identity = findCurrentIdentity(selection, identities);

    expect(selection).toEqual({ kind: "team", teamId: 8 });
    expect(identity?.label).toEqual("八号队");
  });
});
