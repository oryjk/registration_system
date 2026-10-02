/**
 * 跨页面共享的展示格式化函数。
 * 页面不得再各自定义 Intl 格式化（历史上 formatDateTime 曾重复 6 处）。
 */

import { BUSINESS_TIME_ZONE, isCalendarDate, parseInstant } from "./datetime";

/** 中文日期 + 时间（2026年8月30日 14:05），详情页/管理账号列表用。 */
export function formatDateTime(value: string | null | undefined) {
  const date = parseInstant(value);
  return date
    ? new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: BUSINESS_TIME_ZONE,
      }).format(date)
    : "-";
}

/** 紧凑月日 + 时间（08/30 19:00），比赛列表等空间紧张的表格用。 */
export function formatCompactDateTime(value: string | null | undefined) {
  const date = parseInstant(value);
  return date
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: BUSINESS_TIME_ZONE,
      }).format(date)
    : "-";
}

/** 数字日期 + 时间（2026/08/30 19:00），审核/打赏记录等对齐场景用。 */
export function formatNumericDateTime(value: string | null | undefined) {
  const date = parseInstant(value);
  return date
    ? new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: BUSINESS_TIME_ZONE,
      }).format(date)
    : "-";
}

/** 中文日期（8月30日），仅日期列用。 */
export function formatDate(value: string | null | undefined) {
  const date =
    value && isCalendarDate(value)
      ? new Date(`${value}T00:00:00Z`)
      : parseInstant(value);
  return date
    ? new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeZone: BUSINESS_TIME_ZONE,
      }).format(date)
    : "-";
}

/** 按北京时间生成日期输入值，确保收款日期与后端的业务日一致。 */
export function formatShanghaiDateInput(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** 时分秒（14:05:30），仪表盘「最近检查」等需要秒级精度的时间点用。 */
export function formatClockTime(value: string | Date | null | undefined) {
  const date = parseInstant(value);
  return date
    ? new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: BUSINESS_TIME_ZONE,
      }).format(date)
    : "-";
}

/** 相对时间（刚刚 / N 分钟前 / N 小时前 / N 天前），用于最近活跃等运营时间点。 */
export function formatRelativeDateTime(
  value: string | Date | null | undefined,
  now = new Date(),
) {
  const date = parseInstant(value);
  if (!date) return "-";

  const elapsedMs = Math.max(0, now.getTime() - date.getTime());
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (elapsedMs < minuteMs) return "刚刚";
  if (elapsedMs < hourMs) return `${Math.floor(elapsedMs / minuteMs)} 分钟前`;
  if (elapsedMs < dayMs) return `${Math.floor(elapsedMs / hourMs)} 小时前`;
  return `${Math.floor(elapsedMs / dayMs)} 天前`;
}

/** 分转元并加前缀（¥100.00）。 */
export function formatYuan(amountCents: number) {
  return `¥${(amountCents / 100).toFixed(2)}`;
}

/** 分转元（100.00），不带货币前缀。 */
export function formatYuanAmount(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}
