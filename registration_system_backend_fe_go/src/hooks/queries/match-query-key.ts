export function isMatchListQueryKey(queryKey: readonly unknown[]) {
  const query = queryKey[1];
  return (
    queryKey[0] === "matches" &&
    typeof query === "object" &&
    query !== null &&
    !Array.isArray(query)
  );
}
