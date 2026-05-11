function formatDateParam(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function getCurrentYearDateRange(now = new Date()) {
  return {
    startDate: `${now.getFullYear()}-01-01`,
    endDate: formatDateParam(now),
  };
}
