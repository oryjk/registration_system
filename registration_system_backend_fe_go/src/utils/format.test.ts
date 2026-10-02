import {
  formatClockTime,
  formatCompactDateTime,
  formatDate,
  formatDateTime,
  formatNumericDateTime,
  formatRelativeDateTime,
} from "./format";

describe("Shanghai timestamp display", () => {
  it.each([
    "2026-10-01T16:30:00Z",
    "2026-10-02T00:30:00+08:00",
    "2026-10-01T16:30:00",
    "2026-10-01 16:30:00",
  ])("uses Beijing time for %s, including legacy UTC timestamps", (value) => {
    expect(formatNumericDateTime(value)).toBe("2026/10/02 00:30");
    expect(formatCompactDateTime(value)).toBe("10/02 00:30");
    expect(formatDateTime(value)).toBe("2026年10月2日 00:30");
    expect(formatDate(value)).toBe("2026年10月2日");
    expect(formatClockTime(value)).toBe("00:30:00");
  });

  it("preserves a date-only value without interpreting it as a timestamp", () => {
    expect(formatDate("2026-10-02")).toBe("2026年10月2日");
    expect(formatDate("2026-02-30")).toBe("-");
    expect(formatDateTime("2026-10-02")).toBe("-");
  });

  it("interprets legacy timezone-less activity as UTC", () => {
    expect(
      formatRelativeDateTime(
        "2026-10-01 16:15:00",
        new Date("2026-10-01T16:30:00Z"),
      ),
    ).toBe("15 分钟前");
  });
});

describe("formatRelativeDateTime", () => {
  const now = new Date("2026-09-28T12:00:00Z");

  it("formats recent activity in human-friendly buckets", () => {
    expect(formatRelativeDateTime("2026-09-28T11:59:40Z", now)).toBe("刚刚");
    expect(formatRelativeDateTime("2026-09-28T11:45:00Z", now)).toBe(
      "15 分钟前",
    );
    expect(formatRelativeDateTime("2026-09-28T07:00:00Z", now)).toBe(
      "5 小时前",
    );
    expect(formatRelativeDateTime("2026-09-25T12:00:00Z", now)).toBe("3 天前");
  });

  it("handles missing and future timestamps safely", () => {
    expect(formatRelativeDateTime(null, now)).toBe("-");
    expect(formatRelativeDateTime("2026-09-28T12:05:00Z", now)).toBe("刚刚");
  });
});
