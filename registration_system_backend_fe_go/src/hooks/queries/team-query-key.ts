export function isTeamCandidateQueryKey(
  queryKey: readonly unknown[],
  teamID: number,
) {
  return (
    queryKey[0] === "teams" &&
    queryKey[1] === teamID &&
    queryKey[2] === "member-candidates"
  );
}

export function isTeamScopedQueryKey(
  queryKey: readonly unknown[],
  teamID: number,
) {
  return queryKey[0] === "teams" && queryKey[1] === teamID;
}
