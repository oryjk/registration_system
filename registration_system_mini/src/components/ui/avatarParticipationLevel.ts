/** Compact display for registration avatars; the original stars stay unchanged. */
export function avatarParticipationLevel(stars: number | undefined): number | null {
  if (typeof stars !== "number" || !Number.isFinite(stars) || stars < 0) return null;
  return Math.round(stars / 100 * 3);
}
