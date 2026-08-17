import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMiniReviewStatuses, setMiniReviewStatus } from "../../api/miniReview";
import type {
  MiniReviewSetStatusPayload,
  MiniReviewStatusQuery,
} from "../../types/miniReview";
import { queryKeys } from "./keys";

export function useMiniReviewStatusesQuery(query: MiniReviewStatusQuery) {
  return useQuery({
    queryKey: queryKeys.miniReviewStatuses(query),
    queryFn: () => listMiniReviewStatuses(query),
    retry: false,
  });
}

export function useSetMiniReviewStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: MiniReviewSetStatusPayload }) =>
      setMiniReviewStatus(id, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["mini-review"] }),
  });
}
