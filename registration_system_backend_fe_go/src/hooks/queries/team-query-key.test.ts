import { queryKeys } from "./keys";
import {
  isTeamCandidateQueryKey,
  isTeamScopedQueryKey,
} from "./team-query-key";

describe("team query key classification", () => {
  it("matches only candidate searches for the requested team", () => {
    expect(
      isTeamCandidateQueryKey(queryKeys.teamMemberCandidates(7, " 王 "), 7),
    ).toBe(true);
    expect(
      isTeamCandidateQueryKey(queryKeys.teamMemberCandidates(8, "王"), 7),
    ).toBe(false);
    expect(isTeamCandidateQueryKey(queryKeys.teamMembers(7), 7)).toBe(false);
  });

  it("matches detail, members, and candidates without matching list keys", () => {
    expect(isTeamScopedQueryKey(queryKeys.team(7), 7)).toBe(true);
    expect(isTeamScopedQueryKey(queryKeys.teamMembers(7), 7)).toBe(true);
    expect(isTeamScopedQueryKey(queryKeys.teamMemberCandidates(7, ""), 7)).toBe(
      true,
    );
    expect(isTeamScopedQueryKey(queryKeys.teams, 7)).toBe(false);
    expect(isTeamScopedQueryKey(queryKeys.teamOptions, 7)).toBe(false);
  });
});
