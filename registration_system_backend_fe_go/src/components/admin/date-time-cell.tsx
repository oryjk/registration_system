import type { ReactNode } from "react";
import {
  formatCompactDateTime,
  formatDateTime,
  formatNumericDateTime,
  formatRelativeDateTime,
} from "@/utils/format";

/** 表格时间统一为主信息 + 次信息两行；可在主行附带状态徽章。 */
export function DateTimeCell({
  value,
  relative = false,
  badge,
  emptyText = "暂无记录",
}: {
  value: string | null | undefined;
  relative?: boolean;
  badge?: ReactNode;
  emptyText?: string;
}) {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return (
      <div className="date-time-cell">
        {badge ? <div className="date-time-cell-main">{badge}</div> : null}
        <span className="date-time-cell-secondary">{emptyText}</span>
      </div>
    );
  }

  const [date, clock] = formatNumericDateTime(value).split(" ");
  return (
    <div className="date-time-cell">
      <div className="date-time-cell-main">
        <time dateTime={value} title={formatDateTime(value)}>
          {relative ? formatRelativeDateTime(value) : date}
        </time>
        {badge}
      </div>
      <span className="date-time-cell-secondary">
        {relative ? formatCompactDateTime(value) : clock}
      </span>
    </div>
  );
}
