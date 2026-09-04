import { describe, expect, test } from "bun:test";
import { resolveMatchEditScheduleCheck } from "../useMatchEdit";

const NOW = Date.parse("2026-09-04T12:00:00.000Z");

describe("resolveMatchEditScheduleCheck", () => {
  test("future schedule passes directly", () => {
    expect(resolveMatchEditScheduleCheck(
      Date.parse("2026-09-06T18:00:00.000Z"),
      Date.parse("2026-09-06T20:00:00.000Z"),
      NOW,
    )).toEqual("ok");
  });

  test("end at or before start is rejected", () => {
    const start = Date.parse("2026-09-06T18:00:00.000Z");
    expect(resolveMatchEditScheduleCheck(start, start, NOW)).toEqual("invalid-range");
    expect(resolveMatchEditScheduleCheck(start, start - 1, NOW)).toEqual("invalid-range");
  });

  test("missing start or end is rejected", () => {
    expect(resolveMatchEditScheduleCheck(0, NOW + 3600_000, NOW)).toEqual("invalid-range");
    expect(resolveMatchEditScheduleCheck(NOW + 3600_000, 0, NOW)).toEqual("invalid-range");
  });

  test("past start time requires a second confirmation", () => {
    expect(resolveMatchEditScheduleCheck(
      Date.parse("2026-09-01T18:00:00.000Z"),
      Date.parse("2026-09-01T20:00:00.000Z"),
      NOW,
    )).toEqual("past-time");
  });
});
