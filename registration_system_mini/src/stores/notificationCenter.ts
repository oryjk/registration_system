import { computed, ref } from "vue";
import { getCaptainUnreadCount } from "@/api/captainMessage";
import { getUnreadNotificationCount } from "@/api/notification";
import { ensureSessionReady } from "@/stores/appSession";

// Go 后端 notifications 模块已上线（/notifications、/notifications/unread-count、
// /notifications/read-all），未读角标恢复正常拉取。
const NOTIFICATION_SYNC_ENABLED = true;

// 角标拆两层：系统通知与队长留言各自计数，对外合计（底部 tab / 「我的」入口），
// 明细供消息中心的「通知 / 留言」分段各自显示。
const notificationUnreadCount = ref(0);
const captainUnreadCount = ref(0);
const unreadCount = computed(() => notificationUnreadCount.value + captainUnreadCount.value);
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
      // 两类未读并行拉取；单路失败按 0 处理，不影响另一路与合计展示。
      const [notificationResult, captainResult] = await Promise.allSettled([
        getUnreadNotificationCount(),
        getCaptainUnreadCount().then((result) => result.unread_count),
      ]);
      notificationUnreadCount.value = notificationResult.status === "fulfilled" ? notificationResult.value : 0;
      captainUnreadCount.value = captainResult.status === "fulfilled" ? captainResult.value : 0;
      return unreadCount.value;
    } finally {
      isRefreshing.value = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** 调整系统通知未读（本地即时反馈，服务端以 sync 为准）。 */
export function setUnreadCount(nextValue: number) {
  notificationUnreadCount.value = Math.max(0, nextValue);
}

/** 调整留言未读（本地即时反馈，服务端以 sync 为准）。 */
export function setCaptainUnreadCount(nextValue: number) {
  captainUnreadCount.value = Math.max(0, nextValue);
}

export function useNotificationCenter() {
  return {
    unreadCount,
    notificationUnreadCount,
    captainUnreadCount,
    isRefreshing,
    syncUnreadCount,
    setUnreadCount,
    setCaptainUnreadCount,
  };
}
