import { ref } from "vue";
import { getUnreadNotificationCount } from "@/api/notification";
import { ensureSessionReady } from "@/stores/appSession";

// Go 后端 notifications 模块已上线（/notifications、/notifications/unread-count、
// /notifications/read-all），未读角标恢复正常拉取。
const NOTIFICATION_SYNC_ENABLED = true;

const unreadCount = ref(0);
const isRefreshing = ref(false);

let refreshPromise: Promise<number> | null = null;

export async function syncUnreadCount(options?: { skipEnsure?: boolean }) {
  if (!NOTIFICATION_SYNC_ENABLED) {
    return unreadCount.value;
  }

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
