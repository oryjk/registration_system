/**
 * Mock 数据日期辅助工具。
 *
 * 后端的 isRuntimeVisibleActivity / isRuntimeVisibleChallengeSummary 会过滤掉
 * holding_date <= now 的记录，因此 mock 数据不能使用写死的过去日期，
 * 必须基于当前日期偏移生成，确保"未过期"的比赛始终可见。
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 返回距今天 offsetDays 天的日期，格式 "YYYY-MM-DD HH:mm:ss"（后端 holding_date 格式） */
export function dateOffset(offsetDays: number, hour = 20, minute = 0): string {
  const target = new Date();
  target.setDate(target.getDate() + offsetDays);
  target.setHours(hour, minute, 0, 0);
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())} ${pad(hour)}:${pad(minute)}:00`;
}

/** 返回距今天 offsetDays 天的日期，格式 "YYYY-MM-DD"（后端 holding_date 纯日期格式） */
export function dateOnly(offsetDays: number): string {
  return dateOffset(offsetDays).slice(0, 10);
}

/** 返回距今天 offsetDays 天的时间，格式 "HH:mm:ss"（后端 start_time/end_time 格式） */
export function timeOnly(hour: number, minute = 0): string {
  return `${pad(hour)}:${pad(minute)}:00`;
}
