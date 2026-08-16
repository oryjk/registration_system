import { describe, expect, test } from "bun:test";
import { buildRegistrationProgress, resolveRegistrationWindow } from "../detailState";

describe("buildRegistrationProgress", () => {
  test("uses the maximum capacity as the progress denominator", () => {
    expect(buildRegistrationProgress(8, 6, 8)).toEqual({
      baseWidth: "75%",
      extraWidth: "25%",
      splitLeft: "75%",
    });
  });

  test("falls back to the target when maximum capacity is missing", () => {
    expect(buildRegistrationProgress(6, 6)).toEqual({
      baseWidth: "100%",
      extraWidth: "0%",
      splitLeft: "100%",
    });
  });

  test("keeps the denominator valid for an unknown target", () => {
    expect(buildRegistrationProgress(0, 0)).toEqual({
      baseWidth: "0%",
      extraWidth: "0%",
      splitLeft: "0%",
    });
  });
});

describe("resolveRegistrationWindow", () => {
  const start = Date.parse("2026-08-20T08:00:00.000Z");
  const end = Date.parse("2026-08-20T10:00:00.000Z");

  test("uses a half-open interval and selects the active countdown target", () => {
    expect(resolveRegistrationWindow({
      now: start - 1,
      isRegistering: true,
      registrationStartAt: new Date(start).toISOString(),
      registrationEndAt: new Date(end).toISOString(),
    })).toEqual({ state: "not_started", countdownTarget: start });

    expect(resolveRegistrationWindow({
      now: start,
      isRegistering: true,
      registrationStartAt: new Date(start).toISOString(),
      registrationEndAt: new Date(end).toISOString(),
    })).toEqual({ state: "open", countdownTarget: end });

    expect(resolveRegistrationWindow({
      now: end,
      isRegistering: true,
      registrationStartAt: new Date(start).toISOString(),
      registrationEndAt: new Date(end).toISOString(),
    })).toEqual({ state: "closed", countdownTarget: null });
  });

  test("honors partial bounds and status independently", () => {
    expect(resolveRegistrationWindow({
      now: start,
      isRegistering: true,
      registrationStartAt: null,
      registrationEndAt: null,
    })).toEqual({ state: "open", countdownTarget: null });
    expect(resolveRegistrationWindow({
      now: start,
      isRegistering: false,
      registrationStartAt: null,
      registrationEndAt: null,
    })).toEqual({ state: "closed", countdownTarget: null });
  });
});
