import { useQuery } from "@tanstack/react-query";
import { listTips } from "../../api/tips";
import type { TipListQuery } from "../../types/tip";

export function useTipsQuery(query: TipListQuery) {
  return useQuery({
    queryKey: ["tips", query] as const,
    queryFn: () => listTips(query),
    retry: false,
  });
}
