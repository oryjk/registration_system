import { describe, expect, test } from "bun:test";
import { buildRegistrationProgress } from "../detailState";

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
