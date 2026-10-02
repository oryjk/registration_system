import dayjs, { type Dayjs } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

export const BUSINESS_TIME_ZONE = "Asia/Shanghai";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** 纯日期没有时区；校验时禁止 dayjs 把不存在的日期自动滚动到下个月。 */
export function isCalendarDate(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const date = dayjs.utc(value);
  return date.isValid() && date.format("YYYY-MM-DD") === value;
}

/** API 具体时间：保留显式偏移，无时区的旧版服务端时间按 UTC 解析。 */
export function parseInstant(
  value: string | Date | null | undefined,
): Date | null {
  if (!value || (typeof value === "string" && DATE_ONLY.test(value)))
    return null;
  const instant = dayjs.utc(value);
  return instant.isValid() ? instant.toDate() : null;
}

export function toShanghaiTime(
  value: string | Date | Dayjs = new Date(),
): Dayjs {
  const instant = dayjs.isDayjs(value)
    ? value
    : dayjs.utc(parseInstant(value) ?? NaN);
  return instant.tz(BUSINESS_TIME_ZONE);
}

/** 日历的 Date 仅承载年月日，其设备本地时区不是业务时区。 */
export function toCalendarDate(value: Dayjs): Date {
  const shanghai = toShanghaiTime(value);
  return new Date(shanghai.year(), shanghai.month(), shanghai.date(), 12);
}

/** 把日历所选年月日 + 时间输入解释为北京时间，结果仍为一个可提交的 instant。 */
export function fromCalendarDate(
  date: Date,
  hour: number,
  minute: number,
): Dayjs {
  const pad = (value: number) => String(value).padStart(2, "0");
  return dayjs.tz(
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(hour)}:${pad(minute)}:00`,
    BUSINESS_TIME_ZONE,
  );
}
