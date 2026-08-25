import { computed, ref } from "vue";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { buildOtherMatchCards, fetchOtherMatchesPage, OTHER_MATCHES_PAGE_SIZE } from "./otherMatchesState";

/** 首页「其他球队」tab 的加载状态：首次加载、翻页与错误重试。 */
export function useHomeOtherMatches() {
  const isLoading = ref(false);
  const isLoadingMore = ref(false);
  const hasLoadedOnce = ref(false);
  const errorMessage = ref("");
  const matches = ref<HomeMatchCardViewModel[]>([]);
  const page = ref(0);
  const total = ref(0);

  const hasMore = computed(() => matches.value.length < total.value);

  async function loadPage() {
    isLoading.value = true;
    errorMessage.value = "";
    try {
      const response = await fetchOtherMatchesPage(1);
      matches.value = buildOtherMatchCards(response.items);
      page.value = 1;
      total.value = response.total;
      hasLoadedOnce.value = true;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "其他球队比赛加载失败";
    } finally {
      isLoading.value = false;
    }
  }

  async function loadMore() {
    if (isLoading.value || isLoadingMore.value || !hasMore.value || page.value <= 0) return;
    isLoadingMore.value = true;
    try {
      const response = await fetchOtherMatchesPage(page.value + 1);
      const appended = buildOtherMatchCards(response.items);
      // 重复触底/刷新竞态下按 id 去重，保持列表稳定。
      const seen = new Set(matches.value.map((item) => item.id));
      matches.value = [...matches.value, ...appended.filter((item) => !seen.has(item.id))];
      page.value = response.page;
      total.value = response.total;
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "加载更多失败", icon: "none" });
    } finally {
      isLoadingMore.value = false;
    }
  }

  function reset() {
    matches.value = [];
    page.value = 0;
    total.value = 0;
    errorMessage.value = "";
    hasLoadedOnce.value = false;
  }

  return {
    isLoading,
    isLoadingMore,
    hasLoadedOnce,
    errorMessage,
    matches,
    hasMore,
    pageSize: OTHER_MATCHES_PAGE_SIZE,
    loadPage,
    loadMore,
    reset,
  };
}
