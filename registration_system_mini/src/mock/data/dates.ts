/**
 * Mock 数据日期辅助工具。
 *
 * 后端的 isRuntimeVisibleActivity / isRuntimeVisibleChallengeSummary 会过滤掉
 * holding_date <= now 的记录，因此 mock 数据不能使用写死的过去日期，
 * 必须基于当前日期偏移生成，确保"未过期"的比赛始终可见。
 */

import { DAY_MS, beijingDateKey, beijingStartOfDay, mergeBeijingTime, pad } from "@/utils/datetime";

/** Mock 也使用北京时间挂钟输入、UTC 时刻输出，与真实接口保持一致。 */
export function dateOffset(offsetDays: number, hour = 20, minute = 0): string {
  return new Date(mergeBeijingTime(beijingStartOfDay() + offsetDays * DAY_MS, `${pad(hour)}:${pad(minute)}`)).toISOString();
}

export function dateOnly(offsetDays: number): string {
  return beijingDateKey(beijingStartOfDay() + offsetDays * DAY_MS);
}

export function timeOnly(hour: number, minute = 0): string {
  return `${pad(hour)}:${pad(minute)}:00`;
}
