import { avatarParticipationLevel } from "./avatarParticipationLevel";

const participationTiers = [
  { minLevel: 0, title: "倔强青铜", tone: "bronze" },
  { minLevel: 2, title: "秩序白银", tone: "silver" },
  { minLevel: 4, title: "荣耀黄金", tone: "gold" },
  { minLevel: 6, title: "尊贵铂金", tone: "platinum" },
  { minLevel: 8, title: "永恒钻石", tone: "diamond" },
  { minLevel: 10, title: "至尊星耀", tone: "star" },
  { minLevel: 12, title: "最强王者", tone: "king" },
] as const;

/** Every valid cumulative star total, including zero, has an activity tier. */
export function avatarParticipationTier(stars: number | undefined) {
  const level = avatarParticipationLevel(stars);
  if (level === null) return null;
  for (let index = participationTiers.length - 1; index >= 0; index -= 1) {
    if (level >= participationTiers[index].minLevel) return participationTiers[index];
  }
  return null;
}
