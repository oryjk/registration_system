import { expect, test } from "bun:test";
import { avatarParticipationTier } from "../avatarParticipationTier";

test("activity tiers cover every level, independent of leaderboard rank", () => {
  const tones = ["bronze", "silver", "gold", "platinum", "diamond", "star", "king"];
  for (let level = 0; level <= 13; level += 1) {
    expect(avatarParticipationTier(level * 100 / 3)?.tone).toEqual(tones[Math.min(Math.floor(level / 2), 6)]);
  }
  expect(avatarParticipationTier(265)?.title).toEqual("永恒钻石");
  expect(avatarParticipationTier(262.8)?.title).toEqual("永恒钻石");
  expect(avatarParticipationTier(655.5)?.title).toEqual("最强王者");
});

test("tiers use the existing rounded level and preserve missing-data behavior", () => {
  expect(avatarParticipationTier(0)?.title).toEqual("倔强青铜");
  expect(avatarParticipationTier(49.9)?.tone).toEqual("bronze");
  expect(avatarParticipationTier(50)?.tone).toEqual("silver");
  for (const stars of [undefined, NaN, Infinity, -Infinity, -1]) {
    expect(avatarParticipationTier(stars)).toEqual(null);
  }
});
