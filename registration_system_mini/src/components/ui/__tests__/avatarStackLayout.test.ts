import { expect, test } from "bun:test";
import { avatarStackLayout } from "../avatarStackLayout";

test("collapsed layout keeps all seven avatars visible within the available row", () => {
  const layout = avatarStackLayout(7, 240, 26, 7, 5, false);
  expect(layout.positions.length).toEqual(7);
  expect(layout.positions[6]).toEqual({ x: 114, y: 0 });
  expect(layout.height).toEqual(26);
});
test("expansion wraps without overlap and collapse returns each avatar to its original position", () => {
  const layout = avatarStackLayout(9, 100, 26, 7, 5, true);
  expect(layout.positions[3]).toEqual({ x: 0, y: 31 });
  expect(layout.positions[8]).toEqual({ x: 62, y: 62 });
  expect(layout.height).toEqual(88);
  expect(avatarStackLayout(9, 100, 26, 7, 5, false).positions[8]).toEqual({ x: 152, y: 0 });
});
test("empty and very narrow containers have finite dimensions", () => {
  expect(avatarStackLayout(0, 0, 26, 7, 5, true).height).toEqual(0);
  expect(avatarStackLayout(2, 10, 26, 7, 5, true).positions[1]).toEqual({ x: 0, y: 31 });
});
