import { describe, expect, test } from "bun:test";
import { resolveInheritedGuestLimit } from "../matchCapacity";

describe("resolveInheritedGuestLimit", () => {
  test("keeps the guest value when it is configured", () => {
    expect(resolveInheritedGuestLimit(12, 10)).toEqual(10);
  });

  test("inherits the host capacity when the guest value is missing", () => {
    expect(resolveInheritedGuestLimit(12, null)).toEqual(12);
    expect(resolveInheritedGuestLimit(12, undefined)).toEqual(12);
  });

  test("returns null when neither side configures a limit", () => {
    expect(resolveInheritedGuestLimit(null, null)).toEqual(null);
    expect(resolveInheritedGuestLimit(undefined, null)).toEqual(null);
  });
});
