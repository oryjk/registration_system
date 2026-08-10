import { listMyMatches } from "@/api/match";
import type { AppMatchListResponse, AppMatchSummary } from "@/types/match";

const MY_MATCH_PAGE_SIZE = 100;

type FetchMyMatchPage = (page: number, pageSize: number) => Promise<AppMatchListResponse>;

export async function loadAllMyMatches(
  fetchPage: FetchMyMatchPage = (page, pageSize) => listMyMatches({ page, pageSize }),
): Promise<AppMatchSummary[]> {
  const uniqueItems = new Map<string, AppMatchSummary>();
  let page = 1;
  let snapshotTotal: number | null = null;
  let maxPages = 1;

  while (page <= maxPages) {
    const response = await fetchPage(page, MY_MATCH_PAGE_SIZE);
    if (snapshotTotal === null) {
      snapshotTotal = Math.max(response.total, 0);
      maxPages = Math.max(1, Math.ceil(snapshotTotal / MY_MATCH_PAGE_SIZE) + 1);
    }

    let addedCount = 0;
    for (const item of response.items) {
      if (!uniqueItems.has(item.id)) {
        addedCount += 1;
      }
      uniqueItems.set(item.id, item);
    }

    if (
      response.items.length === 0 ||
      addedCount === 0 ||
      uniqueItems.size >= snapshotTotal ||
      response.items.length < MY_MATCH_PAGE_SIZE
    ) {
      return [...uniqueItems.values()];
    }

    page += 1;
  }

  return [...uniqueItems.values()];
}
