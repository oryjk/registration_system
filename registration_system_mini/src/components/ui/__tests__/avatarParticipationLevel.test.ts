import { expect, test } from "bun:test";
import { avatarParticipationLevel } from "../avatarParticipationLevel";

test("registration avatar levels convert annual stars at three levels per hundred", () => {
  expect(avatarParticipationLevel(259)).toEqual(8);
  expect(avatarParticipationLevel(300)).toEqual(9);
  expect(avatarParticipationLevel(94.5)).toEqual(3);
  expect(avatarParticipationLevel(1000)).toEqual(30);
});

test("levels round to the nearest integer, including half levels", () => {
  expect(avatarParticipationLevel(49)).toEqual(1);
  expect(avatarParticipationLevel(50)).toEqual(2);
  expect(avatarParticipationLevel(150)).toEqual(5);
  expect(avatarParticipationLevel(0)).toEqual(0);
});

test("missing or invalid star values do not create a level badge", () => {
  for (const stars of [undefined, NaN, Infinity, -Infinity, -1]) {
    expect(avatarParticipationLevel(stars)).toEqual(null);
  }
});
