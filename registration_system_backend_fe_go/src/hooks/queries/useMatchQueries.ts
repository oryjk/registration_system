import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createMatch,
  deleteMatch,
  getMatch,
  listMatches,
  type UpdateMatchScorePayload,
  updateMatch,
  updateMatchScore,
  updateMatchStatus,
} from "../../api/matches";
import type {
  CreateMatchPayload,
  MatchDetail,
  MatchListQuery,
  MatchStatus,
  UpdateMatchPayload,
} from "../../types/match";
import { queryKeys } from "./keys";
import { isMatchListQueryKey } from "./match-query-key";

function invalidateMatchLists(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) => isMatchListQueryKey(queryKey),
  });
}

export function useMatchesQuery(query: MatchListQuery) {
  return useQuery({
    queryKey: queryKeys.matches(query),
    queryFn: () => listMatches(query),
    retry: false,
  });
}

export function useMatchQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.match(id),
    queryFn: () => getMatch(id),
    enabled: Boolean(id),
    retry: false,
  });
}

function useRefreshMatchData() {
  const queryClient = useQueryClient();

  return (detail: MatchDetail) => {
    queryClient.setQueryData(queryKeys.match(detail.match.id), detail);
    return invalidateMatchLists(queryClient);
  };
}

export function useCreateMatchMutation() {
  const refreshMatchData = useRefreshMatchData();

  return useMutation({
    mutationFn: (payload: CreateMatchPayload) => createMatch(payload),
    onSuccess: refreshMatchData,
  });
}

export function useUpdateMatchMutation() {
  const refreshMatchData = useRefreshMatchData();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateMatchPayload;
    }) => updateMatch(id, payload),
    onSuccess: refreshMatchData,
  });
}

export function useUpdateMatchStatusMutation() {
  const refreshMatchData = useRefreshMatchData();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: MatchStatus }) =>
      updateMatchStatus(id, status),
    onSuccess: refreshMatchData,
  });
}

export function useUpdateMatchScoreMutation() {
  const refreshMatchData = useRefreshMatchData();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateMatchScorePayload;
    }) => updateMatchScore(id, payload),
    onSuccess: refreshMatchData,
  });
}

export function useDeleteMatchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteMatch(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.match(id), exact: true });
      return invalidateMatchLists(queryClient);
    },
  });
}
