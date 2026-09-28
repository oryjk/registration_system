import { formatRelativeDateTime } from "./format";

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
