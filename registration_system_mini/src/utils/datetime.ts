const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

// Asia/Shanghai 自 1992 年起无夏令时。固定 UTC+8，避免依赖小程序 Intl 或设备时区。
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 纯日期保持日期语义；如需时刻，映射到北京时间该日零点。 */
export function beijingDateTimeToTimestamp(dateKey: string, time = "00:00"): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^\d{2}:\d{2}$/.test(time)) return NaN;
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (wallClock.getUTCFullYear() !== year || wallClock.getUTCMonth() !== month - 1 ||
      wallClock.getUTCDate() !== day || hour > 23 || minute > 59) return NaN;
  return wallClock.getTime() - BEIJING_OFFSET_MS;
}

/** Date 始终承载真实时刻。旧接口无时区的 timestamp 按 UTC 解析。 */
export function parseDateValue(isoText: string): Date {
  const text = isoText.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(beijingDateTimeToTimestamp(text));
  const normalized = text.replace(" ", "T");
  const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;
  if (timestampPattern.test(normalized)) return new Date(`${normalized}Z`);
  // 不回退到设备本地日期解析，避免非协议格式在不同手机上代表不同时刻。
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) {
    return new Date(normalized);
  }
  return new Date(NaN);
}

export function beijingDateParts(value: string | number | Date) {
  const instant = typeof value === "string" ? parseDateValue(value).getTime()
    : value instanceof Date ? value.getTime() : value;
  // 此临时 Date 只用 UTC getters 提取北京时间数字，不作为 picker carrier 或真实时刻传递。
  const shifted = new Date(instant + BEIJING_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(), hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(),
  };
}

export function beijingDateKey(value: string | number | Date): string {
  const date = beijingDateParts(value);
  return Number.isFinite(date.year) ? `${date.year}-${pad(date.month)}-${pad(date.day)}` : "";
}

export function beijingStartOfDay(value: string | number | Date = Date.now()): number {
  return beijingDateTimeToTimestamp(beijingDateKey(value));
}

export function beijingTodayAt(hour: number, minute = 0, now = Date.now()): number {
  return beijingDateTimeToTimestamp(beijingDateKey(now), `${pad(hour)}:${pad(minute)}`);
}

/** 原生 date/time picker 的值是挂钟字符串，状态仍存真实毫秒时刻。 */
export function mergeBeijingDate(baseValue: number, dateKey: string): number {
  return beijingDateTimeToTimestamp(dateKey, formatTimeLabel(baseValue || Date.now()));
}

export function mergeBeijingTime(baseValue: number, time: string): number {
  return beijingDateTimeToTimestamp(beijingDateKey(baseValue || Date.now()), time);
}

export function formatBackendDateTime(date: Date): string {
  return date.toISOString();
}

export function formatDateLabel(value: string | number): string {
  return `${formatMonthDayLabel(value)} ${formatTimeLabel(value)}`;
}

export function formatMonthDayLabel(value: string | number): string {
  const date = beijingDateParts(value);
  return `${pad(date.month)}/${pad(date.day)}`;
}

export function formatDayNumberLabel(value: string | number): string {
  return pad(beijingDateParts(value).day);
}

export function formatWeekdayLabel(value: string | number): string {
  return WEEKDAY_LABELS[beijingDateParts(value).weekday] ?? "待定";
}

export function formatTimeLabel(value: string | number): string {
  const date = beijingDateParts(value);
  return `${pad(date.hour)}:${pad(date.minute)}`;
}

export function formatFullDateTimeLabel(value: string | number): string {
  return `${beijingDateKey(value)} ${formatTimeLabel(value)}`;
}

export function formatTimeRangeLabel(startTime: string, endTime: string): string {
  return `${formatTimeLabel(startTime)}-${formatTimeLabel(endTime)}`;
}

export function formatDateTimeWithWeekdayLabel(value: string | number): string {
  return `${formatMonthDayLabel(value)} ${formatWeekdayLabel(value)} ${formatTimeLabel(value)}`;
}

export function formatCountdown(distance: number): string {
  if (distance <= 0) return "已截止";
  const seconds = Math.floor(distance / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainSeconds = seconds % 60;
  return `${pad(hours)} : ${pad(minutes)} : ${pad(remainSeconds)}`;
}

export function describeDaysUntil(target: number, current: number): string {
  if (!target) return "时间待定";
  const diff = target - current;
  if (diff <= 0) return "即将开赛";
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  if (days <= 1) return "1天内开赛";
  return `${days}天后开赛`;
}

export function formatYearLabel(isoText: string): string {
  const date = beijingDateParts(isoText);
  return Number.isNaN(date.year) ? "未知年份" : `${date.year} 年`;
}
