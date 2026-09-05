import { describe, expect, test } from "bun:test";
import {
  resolveMatchEditScheduleCheck,
  resolveMatchTypeChangeState,
  validateMatchTypeChange,
} from "../useMatchEdit";

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

describe("resolveMatchTypeChangeState", () => {
  test("online team match without accepted opponent can switch type", () => {
    const state = resolveMatchTypeChangeState({ publication_mode: "online_team", opponent_state: "recruiting" });
    expect(state.visible).toEqual(true);
    expect(state.options.map((option) => option.value)).toEqual(["offline_confirmed", "online_team", "online_individual"]);
  });

  test("confirmed or non team matches hide the type switch", () => {
    expect(resolveMatchTypeChangeState({ publication_mode: "online_team", opponent_state: "confirmed" }).visible).toEqual(false);
    expect(resolveMatchTypeChangeState({ publication_mode: "offline_confirmed", opponent_state: "no_recruitment" }).visible).toEqual(false);
    expect(resolveMatchTypeChangeState({ publication_mode: "online_individual", opponent_state: "recruiting" }).visible).toEqual(false);
  });
});

describe("validateMatchTypeChange", () => {
  test("offline target requires an opponent name", () => {
    expect(validateMatchTypeChange("offline_confirmed", "")).toEqual("改为「线下已约」需填写对手名称");
    expect(validateMatchTypeChange("offline_confirmed", "  ")).toEqual("改为「线下已约」需填写对手名称");
    expect(validateMatchTypeChange("offline_confirmed", "红星队")).toEqual(null);
  });

  test("individual target forbids a manual opponent name", () => {
    expect(validateMatchTypeChange("online_individual", "红星队")).toEqual("「散人对手」不能填写对手名称，请先清空");
    expect(validateMatchTypeChange("online_individual", "")).toEqual(null);
  });

  test("no switch or staying on team mode has no constraint", () => {
    expect(validateMatchTypeChange(null, "")).toEqual(null);
    expect(validateMatchTypeChange("online_team", "随便填")).toEqual(null);
  });
});
