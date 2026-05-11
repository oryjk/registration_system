export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

function formatDateParam(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function toDateParam(value: string): string {
  const directDate = value.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(directDate)) {
    return directDate;
  }

  return formatDateParam(new Date(value.replace(" ", "T")));
}

export function getCurrentYearDateRange(now = new Date()): DateRangeParams {
  return {
    startDate: `${now.getFullYear()}-01-01`,
    endDate: formatDateParam(now),
  };
}

export function isDateInRange(value: string, range: DateRangeParams): boolean {
  const dateParam = toDateParam(value);
  return (!range.startDate || dateParam >= range.startDate) && (!range.endDate || dateParam <= range.endDate);
}
