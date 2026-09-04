import { describe, expect, test } from "bun:test";
import { resolveRegistrationWindow } from "../registrationWindow";

const NOW = Date.parse("2026-09-04T12:00:00.000Z");

describe("resolveRegistrationWindow", () => {
  test("registering match without bounds stays open before match end", () => {
    expect(resolveRegistrationWindow({
      now: NOW,
      isRegistering: true,
      matchEndAt: "2026-09-06T20:00:00Z",
    })).toEqual({ state: "open", countdownTarget: null });
  });

  test("time-expired match is closed even while still registering", () => {
    expect(resolveRegistrationWindow({
      now: NOW,
      isRegistering: true,
      matchEndAt: "2026-09-04T10:00:00Z",
    })).toEqual({ state: "closed", countdownTarget: null });
  });

  test("match end takes precedence over a later registration window end", () => {
    expect(resolveRegistrationWindow({
      now: NOW,
      isRegistering: true,
      registrationEndAt: "2026-09-08T00:00:00Z",
      matchEndAt: "2026-09-04T10:00:00Z",
    })).toEqual({ state: "closed", countdownTarget: null });
  });

  test("non-registering match is closed regardless of times", () => {
    expect(resolveRegistrationWindow({
      now: NOW,
      isRegistering: false,
      matchEndAt: "2026-09-08T20:00:00Z",
    })).toEqual({ state: "closed", countdownTarget: null });
  });

  test("registration window bounds still apply when match has not ended", () => {
    expect(resolveRegistrationWindow({
      now: NOW,
      isRegistering: true,
      registrationStartAt: "2026-09-05T00:00:00Z",
      matchEndAt: "2026-09-06T20:00:00Z",
    })).toEqual({ state: "not_started", countdownTarget: Date.parse("2026-09-05T00:00:00Z") });
    expect(resolveRegistrationWindow({
      now: NOW,
      isRegistering: true,
      registrationEndAt: "2026-09-01T00:00:00Z",
      matchEndAt: "2026-09-06T20:00:00Z",
    })).toEqual({ state: "closed", countdownTarget: null });
  });
});
