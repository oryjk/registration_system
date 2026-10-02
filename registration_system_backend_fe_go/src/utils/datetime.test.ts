import {
  fromCalendarDate,
  isCalendarDate,
  parseInstant,
  toCalendarDate,
  toShanghaiTime,
} from "./datetime";
import { buildUpdateMatchPayload } from "./match-form-payload";

describe("Beijing date/time input", () => {
  it("keeps the instant when mapping a Beijing day through a local calendar carrier", () => {
    const value = toShanghaiTime("2026-10-01T16:30:00Z");
    const calendar = toCalendarDate(value);
    expect([
      calendar.getFullYear(),
      calendar.getMonth() + 1,
      calendar.getDate(),
    ]).toEqual([2026, 10, 2]);
    expect(fromCalendarDate(calendar, 0, 30).toISOString()).toBe(
      "2026-10-01T16:30:00.000Z",
    );
  });

  it("submits edited Beijing wall time as UTC, including the registration window", () => {
    const start = fromCalendarDate(new Date(2026, 9, 3, 12), 1, 45);
    expect(
      buildUpdateMatchPayload({
        name: "test",
        publication_mode: "online_team",
        players_per_team: 8,
        start_time: start,
        duration_minutes: 120,
        registration_start_at: toShanghaiTime("2026-09-01 00:00:00"),
        registration_end_at: start.subtract(2, "hour"),
        location: "test",
      }),
    ).toMatchObject({
      start_time: "2026-10-02T17:45:00.000Z",
      end_time: "2026-10-02T19:45:00.000Z",
      registration_start_at: "2026-09-01T00:00:00.000Z",
      registration_end_at: "2026-10-02T15:45:00.000Z",
    });
  });

  it("uses the selected Beijing day even on a device DST transition", () => {
    expect(
      fromCalendarDate(new Date(2026, 2, 8, 12), 2, 30).toISOString(),
    ).toBe("2026-03-07T18:30:00.000Z");
  });

  it("separates calendar dates from instants and rejects invalid input", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2026-10-02T00:30:00+08:00")).toBe(false);
    expect(parseInstant("2026-10-02")).toBeNull();
    expect(parseInstant("invalid")).toBeNull();
    expect(parseInstant(null)).toBeNull();
    expect(parseInstant("2026-10-01 16:30:00")?.toISOString()).toBe(
      "2026-10-01T16:30:00.000Z",
    );
  });
});
