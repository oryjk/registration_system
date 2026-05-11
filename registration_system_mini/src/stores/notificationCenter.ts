import { ref } from "vue";
import { getUnreadNotificationCount } from "@/api/notification";
import { ensureSessionReady } from "@/stores/appSession";

const unreadCount = ref(0);
const isRefreshing = ref(false);

let refreshPromise: Promise<number> | null = null;

export async function syncUnreadCount(options?: { skipEnsure?: boolean }) {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    isRefreshing.value = true;
    try {
      if (!options?.skipEnsure) {
        await ensureSessionReady();
      }
      unreadCount.value = await getUnreadNotificationCount();
      return unreadCount.value;
    } catch (error) {
      unreadCount.value = 0;
      throw error;
    } finally {
      isRefreshing.value = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function setUnreadCount(nextValue: number) {
  unreadCount.value = Math.max(0, nextValue);
}

export function useNotificationCenter() {
  return {
    unreadCount,
    isRefreshing,
    syncUnreadCount,
    setUnreadCount,
  };
}
