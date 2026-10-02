import { DateTimeCell } from "@/components/admin/date-time-cell";
import { StatusBadge } from "@/components/admin/status-badge";
import { parseInstant } from "@/utils/datetime";

const DAY_MS = 24 * 60 * 60 * 1000;

function activityStatus(lastActiveAt: string | null) {
  if (!lastActiveAt) return { label: "从未记录", variant: "secondary" };
  const date = parseInstant(lastActiveAt);
  if (!date) return { label: "时间异常", variant: "warning" };
  const timestamp = date.getTime();
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed <= 7 * DAY_MS) return { label: "7 日内活跃", variant: "success" };
  if (elapsed <= 30 * DAY_MS) return { label: "30 日内活跃", variant: "info" };
  return { label: "30 天未活跃", variant: "warning" };
}

/** 沿用统一活跃分档，与时间单元格共用两行排版。 */
export function ActivityCell({
  lastActiveAt,
  showStatus = true,
}: {
  lastActiveAt: string | null;
  /** 简洁目录可省略活跃分档徽章，仍保留相对时间和精确时间。 */
  showStatus?: boolean;
}) {
  const status = activityStatus(lastActiveAt);
  return (
    <DateTimeCell
      badge={
        showStatus ? (
          <StatusBadge label={status.label} variant={status.variant} />
        ) : undefined
      }
      emptyText="暂无活跃记录"
      relative
      value={lastActiveAt}
    />
  );
}
