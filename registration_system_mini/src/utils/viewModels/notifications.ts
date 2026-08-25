import type { BackendNotification } from "@/types/backend";
import type { NotificationItemViewModel } from "@/types/viewModels";
import { formatDateLabel } from "@/utils/datetime";

function toNotificationKindLabel(kind: string): string {
  switch (kind) {
    case "challenge_matched":
      return "约队已约成";
    case "challenge_created":
      return "约队已发布";
    case "challenge_cancelled":
      return "约队已取消";
    case "teamfund_depleted":
      return "队费余额不足";
    case "teamfund_credited":
      return "队费充值到账";
    default:
      return "系统通知";
  }
}

function toNotificationRelatedPath(notification: BackendNotification): string {
  if (notification.related_type === "challenge" && notification.related_id) {
    return `/pages/challenges/detail?id=${notification.related_id}`;
  }
  if (notification.related_type === "activity" && notification.related_id) {
    return `/pages/matches/detail?id=${notification.related_id}`;
  }
  if (notification.related_type === "match" && notification.related_id) {
    return `/pages/matches/detail?id=${notification.related_id}`;
  }
  return "";
}

export function buildNotificationItems(notifications: BackendNotification[]): NotificationItemViewModel[] {
  return notifications.map((item) => ({
    id: item.id,
    title: item.title,
    content: item.content,
    kindLabel: toNotificationKindLabel(item.kind),
    createdAtLabel: formatDateLabel(item.created_at),
    read: !!item.read_at,
    relatedPath: toNotificationRelatedPath(item),
  }));
}
