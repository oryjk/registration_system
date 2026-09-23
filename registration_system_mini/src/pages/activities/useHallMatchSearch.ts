import { computed, ref, watch, type Ref } from "vue";
import { listMatches, type ListMatchesParams } from "@/api/match";
import type { AppMatchSummary } from "@/types/match";

const PAGE_SIZE = 10;
interface SearchStream { scope: "all" | "mine"; page: number; hasMore: boolean; items: AppMatchSummary[] }
const initialStreams = (): SearchStream[] => ["all", "mine"].map(scope => ({ scope: scope as "all" | "mine", page: 0, hasMore: true, items: [] }));

/** 大厅可加入比赛与我的全部比赛分别分页，按 ID 合并；日期筛选不截断个人历史记录。 */
export function useHallMatchSearch(isGuest: Ref<boolean>, fetchMatches = listMatches) {
  const searchQuery = ref("");
  const activeSearchQuery = ref("");
  const isSearching = ref(false);
  const searchErrorMessage = ref("");
  const streams = ref(initialStreams());
  let version = 0;
  let searchTime = new Date();
  const hasSearched = computed(() => !!activeSearchQuery.value);
  const searchHasMore = computed(() => hasSearched.value && streams.value.some(stream => stream.hasMore));
  const searchMatches = computed(() => {
    const merged = new Map<string, AppMatchSummary>();
    for (const stream of streams.value) for (const match of stream.items) merged.set(match.id, match);
    return [...merged.values()]
      .sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time) || a.id.localeCompare(b.id));
  });

  async function loadMoreSearchResults() {
    if (isSearching.value || !hasSearched.value || !searchHasMore.value || isGuest.value) return;
    const requestVersion = version;
    const pending = streams.value.filter(stream => stream.hasMore);
    isSearching.value = true;
    searchErrorMessage.value = "";
    try {
      const responses = await Promise.all(pending.map(stream => {
        const params: ListMatchesParams = { scope: stream.scope, search: activeSearchQuery.value, page: stream.page + 1, pageSize: PAGE_SIZE };
        if (stream.scope === "all") {
          params.status = "registering";
          params.startsAfter = searchTime;
          params.publicationModes = ["online_team", "online_individual", "online_pickup"];
        }
        return fetchMatches(params);
      }));
      if (requestVersion !== version) return;
      responses.forEach((response, index) => {
        const stream = pending[index]!;
        stream.items = [...stream.items, ...response.items];
        stream.page = response.page;
        stream.hasMore = response.items.length > 0 && response.page * response.page_size < response.total;
      });
    } catch (error) {
      if (requestVersion !== version) return;
      searchErrorMessage.value = error instanceof Error ? error.message : "比赛搜索失败，请重试";
    } finally {
      if (requestVersion === version) isSearching.value = false;
    }
  }

  function clearSearchResults() {
    version += 1;
    searchQuery.value = "";
    activeSearchQuery.value = "";
    streams.value = initialStreams();
    isSearching.value = false;
    searchErrorMessage.value = "";
  }

  async function handleSearch() {
    const keyword = searchQuery.value.trim();
    clearSearchResults();
    searchQuery.value = keyword;
    if (!keyword || isGuest.value) return;
    activeSearchQuery.value = keyword;
    searchTime = new Date();
    await loadMoreSearchResults();
  }
  watch(isGuest, value => { if (value) clearSearchResults(); });

  return { searchQuery, activeSearchQuery, isSearching, hasSearched, searchErrorMessage, searchMatches, searchHasMore, handleSearch, clearSearchResults, loadMoreSearchResults };
}
