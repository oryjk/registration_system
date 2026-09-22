import { describe, expect, test } from "bun:test";
import { registrationProgressState } from "../registrationProgressState";

describe("registrationProgressState", () => {
  test("uses registered headcount for progress and the minimum threshold", () => {
    const state = registrationProgressState(7, 8, 10);
    expect(state.countLabel).toEqual("还差 1 人成行");
    expect(state.basePercent).toEqual(70);
    expect(state.minimumPercent).toEqual(80);
    expect(state.belowMinimum).toEqual(true);
  });
  test("splits above-minimum progress and caps over-capacity display", () => {
    const state = registrationProgressState(12, 8, 10);
    expect(state.countLabel).toEqual("已满员");
    expect([state.basePercent, state.extraPercent, state.progressPercent]).toEqual([80, 20, 100]);
  });
  test("does not invent a capacity for unlimited groups", () => {
    const unlimited = registrationProgressState(7, 0, 0);
    expect([unlimited.minimum, unlimited.maximum, unlimited.progressPercent]).toEqual([null, null, null]);
    const minimumOnly = registrationProgressState(9, 8, null);
    expect(minimumOnly.countLabel).toEqual("已达成行人数");
    expect(minimumOnly.maximum).toEqual(null);
    expect(minimumOnly.progressPercent).toEqual(100);
  });
});
