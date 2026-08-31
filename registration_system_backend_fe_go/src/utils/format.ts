/**
 * 跨页面共享的展示格式化函数。
 * 页面不得再各自定义 Intl 格式化（历史上 formatDateTime 曾重复 6 处）。
 */

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 中文日期 + 时间（2026年8月30日 14:05），详情页/管理账号列表用。 */
export function formatDateTime(value: string | null | undefined) {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)
    : "-";
}

/** 紧凑月日 + 时间（08/30 19:00），比赛列表等空间紧张的表格用。 */
export function formatCompactDateTime(value: string | null | undefined) {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date)
    : "-";
}

/** 数字日期 + 时间（2026/08/30 19:00），审核/打赏记录等对齐场景用。 */
export function formatNumericDateTime(value: string | null | undefined) {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date)
    : "-";
}

/** 中文日期（8月30日），仅日期列用。 */
export function formatDate(value: string | null | undefined) {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(date)
    : "-";
}

/** 时分秒（14:05:30），仪表盘「最近检查」等需要秒级精度的时间点用。 */
export function formatClockTime(value: string | Date | null | undefined) {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date)
    : "-";
}

/** 分转元并加前缀（¥100.00）。 */
export function formatYuan(amountCents: number) {
  return `¥${(amountCents / 100).toFixed(2)}`;
}

/** 分转元（100.00），不带货币前缀。 */
export function formatYuanAmount(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}
