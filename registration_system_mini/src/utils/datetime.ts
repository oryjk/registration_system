const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

export function parseDateValue(isoText: string): Date {
  return new Date(isoText.replace(" ", "T"));
}

export function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDateLabel(isoText: string): string {
  const date = parseDateValue(isoText);
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatMonthDayLabel(isoText: string): string {
  const date = parseDateValue(isoText);
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

export function formatDayNumberLabel(isoText: string): string {
  const date = parseDateValue(isoText);
  return pad(date.getDate());
}

export function formatWeekdayLabel(isoText: string): string {
  const date = parseDateValue(isoText);
  return WEEKDAY_LABELS[date.getDay()] ?? "待定";
}

export function formatTimeLabel(isoText: string): string {
  const date = parseDateValue(isoText);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatTimeRangeLabel(startTime: string, endTime: string): string {
  return `${formatTimeLabel(startTime)}-${formatTimeLabel(endTime)}`;
}

export function formatDateTimeWithWeekdayLabel(isoText: string): string {
  const date = parseDateValue(isoText);
  const weekday = WEEKDAY_LABELS[date.getDay()] ?? "";
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${weekday} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  const date = parseDateValue(isoText);
  return Number.isNaN(date.getTime()) ? "未知年份" : `${date.getFullYear()} 年`;
}
