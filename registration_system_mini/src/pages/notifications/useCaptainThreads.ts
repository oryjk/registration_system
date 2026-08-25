import { computed, ref, type ComputedRef } from "vue";
import { listCaptainThreads } from "@/api/captainMessage";
import type { AppCaptainThreadSummary } from "@/types/captainMessage";
import { buildCaptainThreadItems, type CaptainThreadItemViewModel } from "./captainThreadListState";

const THREAD_PAGE_SIZE = 20;

/** 消息中心「留言」板块的加载状态与分页。 */
export function useCaptainThreads(myUserId: ComputedRef<number | null>) {
  const isLoading = ref(false);
  const isLoadingMore = ref(false);
  const hasLoadedOnce = ref(false);
  const errorMessage = ref("");
  const threads = ref<AppCaptainThreadSummary[]>([]);
  const page = ref(0);
  const total = ref(0);

  const items = computed(() => buildCaptainThreadItems(threads.value, myUserId.value));
  const hasMore = computed(() => threads.value.length < total.value);

  async function loadPage() {
    isLoading.value = true;
    errorMessage.value = "";
    try {
      const response = await listCaptainThreads({ page: 1, pageSize: THREAD_PAGE_SIZE });
      threads.value = response.items;
      page.value = response.page;
      total.value = response.total;
      hasLoadedOnce.value = true;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "留言加载失败";
    } finally {
      isLoading.value = false;
    }
  }

  async function loadMore() {
    if (isLoading.value || isLoadingMore.value || !hasMore.value || page.value <= 0) return;
    isLoadingMore.value = true;
    try {
      const response = await listCaptainThreads({ page: page.value + 1, pageSize: THREAD_PAGE_SIZE });
      const seen = new Set(threads.value.map((item) => item.id));
      threads.value = [...threads.value, ...response.items.filter((item) => !seen.has(item.id))];
      page.value = response.page;
      total.value = response.total;
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "加载更多失败", icon: "none" });
    } finally {
      isLoadingMore.value = false;
    }
  }

  return {
    isLoading,
    isLoadingMore,
    hasLoadedOnce,
    errorMessage,
    items,
    hasMore,
    loadPage,
    loadMore,
  };
}
