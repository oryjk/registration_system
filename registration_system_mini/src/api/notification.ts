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

export function markAllNotificationsRead() {
  return requestApi<BackendNotificationMarkAllReadResult>({
    url: "/notifications/read-all",
    method: "POST",
    auth: true,
  });
}
