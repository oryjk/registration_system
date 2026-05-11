import { describe, expect, test } from "bun:test";
import { canShowTeamRegistrationTab } from "../matches/registrationVisibility";

describe("match registration visibility", () => {
  test("hides team registration when the current team is the publishing team", () => {
    expect(
      canShowTeamRegistrationTab({
        currentTeamId: "team-a",
        canManageTeam: true,
        homeTeamId: "team-a",
      }),
    ).toEqual(false);
  });

  test("hides team registration for derived team-signup activities", () => {
    expect(
      canShowTeamRegistrationTab({
        currentTeamId: "team-a",
        canManageTeam: true,
        homeTeamId: "team-b",
        sourceActivityId: "activity-1",
      }),
    ).toEqual(false);
  });

  test("shows team registration only for managers on non-derived activities of other teams", () => {
    expect(
      canShowTeamRegistrationTab({
        currentTeamId: "team-a",
        canManageTeam: true,
        homeTeamId: "team-b",
      }),
    ).toEqual(true);
  });
});
