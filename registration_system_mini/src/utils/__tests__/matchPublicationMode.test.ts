import { describe, expect, test } from "bun:test";
import {
  getMatchPublicationModeLabel,
  MATCH_PUBLICATION_MODE_OPTIONS,
} from "../matchPublicationMode";

describe("match publication mode presentation", () => {
  test("maps all publication modes and falls back for future read-only values", () => {
    expect(getMatchPublicationModeLabel("offline_confirmed")).toEqual("线下已约");
    expect(getMatchPublicationModeLabel("online_team")).toEqual("线上约队");
    expect(getMatchPublicationModeLabel("online_individual")).toEqual("散人对手");
    expect(getMatchPublicationModeLabel("future_mode")).toEqual("其他类型");
  });

  test("exposes the three supported create options in workflow order", () => {
    expect(MATCH_PUBLICATION_MODE_OPTIONS.map(({ value, label }) => ({ value, label }))).toEqual([
      { value: "offline_confirmed", label: "线下已约" },
      { value: "online_team", label: "线上约队" },
      { value: "online_individual", label: "散人对手" },
    ]);
  });
});
