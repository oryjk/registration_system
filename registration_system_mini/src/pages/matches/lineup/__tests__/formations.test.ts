import { describe, expect, test } from "bun:test";
import {
  FORMATIONS_BY_SIZE,
  SUPPORTED_TEAM_SIZES,
  getDefaultFormation,
  getFormation,
  getFormationOptions,
  isValidFormation,
  normalizePlayersPerTeam,
} from "../formations";
import { COORD_MAX, COORD_MIN } from "../helpers";

describe("lineup formations", () => {
  test("matches backend preset list for every team size 5..11", () => {
    expect(FORMATIONS_BY_SIZE).toEqual({
      5: ["1-2-1", "2-2", "1-1-2", "2-1-1"],
      6: ["2-2-1", "2-1-2", "1-3-1"],
      7: ["2-3-1", "3-2-1", "2-2-2"],
      8: ["3-3-1", "2-3-2", "3-2-2", "2-4-1", "3-1-3"],
      9: ["3-3-2", "3-4-1", "4-3-1"],
      10: ["4-3-2", "3-4-2", "4-4-1"],
      11: ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2"],
    });
  });

  test("every formation produces exact slot count, sequential indices, GK at slot 0, and safe coords", () => {
    for (const size of SUPPORTED_TEAM_SIZES) {
      for (const code of getFormationOptions(size)) {
        const slots = getFormation(size, code);
        expect(slots.length).toEqual(size);
        expect(slots[0].position).toEqual("GK");
        expect(slots[0].label).toEqual("门将");
        slots.forEach((slot, index) => {
          expect(slot.slot).toEqual(index);
          expect(slot.x >= COORD_MIN && slot.x <= COORD_MAX).toEqual(true);
          expect(slot.y >= COORD_MIN && slot.y <= COORD_MAX).toEqual(true);
          expect(slot.label.length > 0).toEqual(true);
        });
      }
    }
  });

  test("normalizes unsupported players_per_team to 5 and falls back unknown formation", () => {
    expect(normalizePlayersPerTeam(null)).toEqual(5);
    expect(normalizePlayersPerTeam(undefined)).toEqual(5);
    expect(normalizePlayersPerTeam(3)).toEqual(5);
    expect(normalizePlayersPerTeam(12)).toEqual(5);
    expect(normalizePlayersPerTeam(8)).toEqual(8);

    expect(getDefaultFormation(8)).toEqual("3-3-1");
    expect(isValidFormation(8, "3-3-1")).toEqual(true);
    expect(isValidFormation(8, "4-3-3")).toEqual(false);
    expect(getFormation(8, "invalid").length).toEqual(8);
  });
});
