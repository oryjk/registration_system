import { ref } from "vue";
import { getUnreadNotificationCount } from "@/api/notification";
import { ensureSessionReady } from "@/stores/appSession";

// Go 后端尚未提供 notifications 模块（/notifications/unread-count 目前 404），
// 先暂停自动拉取避免无效请求刷日志；Go 端需求定稿并实现接口后改回 true 即可恢复。
const NOTIFICATION_SYNC_ENABLED = false;

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
