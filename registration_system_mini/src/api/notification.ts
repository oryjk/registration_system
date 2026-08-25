import type {
  BackendNotification,
  BackendNotificationMarkAllReadResult,
  BackendNotificationUnreadCountResult,
} from "@/types/backend";
import { buildQueryString } from "@/utils/queryString";
import { requestApi } from "@/utils/request";

export function listNotifications(params?: { unreadOnly?: boolean; limit?: number }) {
  const queryString = buildQueryString({
    unread_only: params?.unreadOnly ? true : undefined,
    limit: params?.limit,
  });

  return requestApi<BackendNotification[]>({
    url: `/notifications${queryString ? `?${queryString}` : ""}`,
    auth: true,
  });
}

export async function getUnreadNotificationCount() {
  const result = await requestApi<BackendNotificationUnreadCountResult>({
    url: "/notifications/unread-count",
    auth: true,
  });
  return result.unread_count;
}

/** 标记单条通知已读：用户点开通知详情时调用，未点开不算已读。 */
export function markNotificationRead(id: number) {
  return requestApi<{ read: boolean }>({
    url: `/notifications/${id}/read`,
    method: "POST",
    auth: true,
  });
}

export function markAllNotificationsRead() {
  return requestApi<BackendNotificationMarkAllReadResult>({
    url: "/notifications/read-all",
    method: "POST",
    auth: true,
  });
}
