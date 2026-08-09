import type { AppMatchListResponse, AppMatchSummary, AppMatchUiPhase } from "@/types/match";
import { groupMatchesByPhase } from "../homeMatchState";

type VisibleHomeMatchPhase = Exclude<AppMatchUiPhase, "excluded">;

export interface HomeMatchPaginationState {
  sourceItems: AppMatchSummary[];
  nextPage: number;
  total: number;
  pageSize: number;
}

function mergeLatestSourceItems(sourceItems: AppMatchSummary[], pageItems: AppMatchSummary[]): AppMatchSummary[] {
  const merged = new Map<string, AppMatchSummary>();

  for (const item of sourceItems) {
    merged.set(item.id, item);
  }

  for (const item of pageItems) {
    if (merged.has(item.id)) {
      merged.delete(item.id);
    }
    merged.set(item.id, item);
  }

  return [...merged.values()];
}

function countVisibleItems(items: AppMatchSummary[], phase: VisibleHomeMatchPhase, now: Date): number {
  return groupMatchesByPhase(items, now)[phase].length;
}

export async function loadNextVisiblePhaseBatch(
  state: HomeMatchPaginationState,
  phase: VisibleHomeMatchPhase,
  now: Date,
  fetchPage: (page: number, pageSize: number) => Promise<AppMatchListResponse>,
): Promise<HomeMatchPaginationState> {
  if (state.total > 0 && state.sourceItems.length >= state.total) {
    return state;
  }

  const sourceItems = [...state.sourceItems];
  const visibleBefore = countVisibleItems(sourceItems, phase, now);
  let currentPage = state.nextPage;

  while (true) {
    const response = await fetchPage(currentPage, state.pageSize);

    if (response.items.length === 0) {
      return {
        sourceItems,
        nextPage: currentPage + 1,
        total: sourceItems.length,
        pageSize: state.pageSize,
      };
    }

    const mergedSourceItems = mergeLatestSourceItems(sourceItems, response.items);
    sourceItems.splice(0, sourceItems.length, ...mergedSourceItems);

    const visibleAfter = countVisibleItems(sourceItems, phase, now);
    const nextTotal = Math.max(state.total, response.total, sourceItems.length);

    currentPage += 1;
    if (visibleAfter > visibleBefore || sourceItems.length >= nextTotal) {
      return {
        sourceItems,
        nextPage: currentPage,
        total: nextTotal,
        pageSize: state.pageSize,
      };
    }
  }
}
