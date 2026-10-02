import { beijingDateKey, beijingDateParts } from "./datetime";

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export function getCurrentYearDateRange(now = new Date()): DateRangeParams {
  return {
    startDate: `${beijingDateParts(now).year}-01-01`,
    endDate: beijingDateKey(now),
  };
}

export function isDateInRange(value: string, range: DateRangeParams): boolean {
  const dateParam = beijingDateKey(value);
  return !!dateParam && (!range.startDate || dateParam >= range.startDate) && (!range.endDate || dateParam <= range.endDate);
}
