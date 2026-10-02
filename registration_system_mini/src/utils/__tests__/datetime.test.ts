import { describe, expect, test } from "bun:test";
import { beijingDateTimeToTimestamp, beijingDateKey, beijingStartOfDay, beijingTodayAt, mergeBeijingDate, mergeBeijingTime, formatFullDateTimeLabel, formatDateLabel, formatTimeLabel, formatWeekdayLabel, formatYearLabel, parseDateValue } from "../datetime";
import { getCurrentYearDateRange, isDateInRange } from "../dateRange";

describe("Beijing business dates", () => {
  test("UTC instants display Beijing date, clock, weekday and year", () => {
    expect(formatDateLabel("2026-12-31T16:30:00Z")).toEqual("01/01 00:30");
    expect(formatFullDateTimeLabel("2026-12-31T16:30:00Z")).toEqual("2027-01-01 00:30");
    expect(formatTimeLabel("2026-10-02T12:00:00+00:00")).toEqual("20:00");
    expect(formatWeekdayLabel("2026-12-31T16:30:00Z")).toEqual("周五");
    expect(formatYearLabel("2026-12-31T16:30:00Z")).toEqual("2027 年");
  });
  test("legacy timezone-free timestamps are UTC, pure dates stay calendar dates", () => {
    expect(parseDateValue("2026-10-02 12:00:00").toISOString()).toEqual("2026-10-02T12:00:00.000Z");
    expect(formatDateLabel("2026-10-02 12:00:00")).toEqual("10/02 20:00");
    expect(formatYearLabel("2026-12-31")).toEqual("2026 年");
    expect(Number.isNaN(parseDateValue("2026/10/02 12:00:00").getTime())).toEqual(true);
  });
  test("date filters use Beijing day rather than UTC prefix or device day", () => {
    expect(getCurrentYearDateRange(new Date("2026-12-31T16:30:00Z"))).toEqual({ startDate: "2027-01-01", endDate: "2027-01-01" });
    expect(isDateInRange("2026-12-31T16:30:00Z", { startDate: "2027-01-01", endDate: "2027-01-01" })).toEqual(true);
    expect(isDateInRange("2026-12-31", { startDate: "2027-01-01" })).toEqual(false);
  });
});


test("picker wall-clock changes preserve real instants and serialize UTC once", () => {
  const start = parseDateValue("2026-10-02T12:30:45Z").getTime();
  expect(new Date(mergeBeijingDate(start, "2026-10-03")).toISOString()).toEqual("2026-10-03T12:30:00.000Z");
  expect(new Date(mergeBeijingTime(start, "21:15")).toISOString()).toEqual("2026-10-02T13:15:00.000Z");
  expect(new Date(beijingDateTimeToTimestamp("2027-01-01", "00:30")).toISOString()).toEqual("2026-12-31T16:30:00.000Z");
  expect(new Date(beijingTodayAt(20, 0, Date.parse("2026-12-31T16:30:00Z"))).toISOString()).toEqual("2027-01-01T12:00:00.000Z");
  expect(new Date(beijingStartOfDay("2026-12-31T16:30:00Z")).toISOString()).toEqual("2026-12-31T16:00:00.000Z");
  expect(beijingDateKey("2026-10-02T23:30:00-07:00")).toEqual("2026-10-03");
  expect(Number.isNaN(beijingDateTimeToTimestamp("2026-02-30"))).toEqual(true);
  expect(Number.isNaN(beijingDateTimeToTimestamp("2026-10-02", "24:00"))).toEqual(true);
});
