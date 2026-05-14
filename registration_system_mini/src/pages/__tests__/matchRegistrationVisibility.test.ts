import { describe, expect, test } from "bun:test";
import { canShowTeamRegistrationTab } from "../matches/registrationVisibility";

describe("match registration visibility", () => {
  test("hides team registration when the current team is the publishing team", () => {
    expect(
      canShowTeamRegistrationTab({
        currentTeamId: 1,
        canManageTeam: true,
        homeTeamId: 1,
      }),
    ).toEqual(false);
  });

  test("hides team registration for derived team-signup activities", () => {
    expect(
      canShowTeamRegistrationTab({
        currentTeamId: 1,
        canManageTeam: true,
        homeTeamId: 2,
        sourceActivityId: "activity-1",
      }),
    ).toEqual(false);
  });

  test("shows team registration only for managers on non-derived activities of other teams", () => {
    expect(
      canShowTeamRegistrationTab({
        currentTeamId: 1,
        canManageTeam: true,
        homeTeamId: 2,
      }),
    ).toEqual(true);
  });
});
