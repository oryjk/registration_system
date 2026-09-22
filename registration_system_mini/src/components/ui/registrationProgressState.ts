/** Shared presentation only: does not enforce registration capacity or eligibility. */
export function registrationProgressState(joined: number, min?: number | null, max?: number | null) {
  const minimum = min && min > 0 ? min : null;
  const maximum = max && max > 0 ? max : null;
  const full = maximum !== null && joined >= maximum;
  const countLabel = full ? "已满员"
    : minimum && joined < minimum ? `还差 ${minimum - joined} 人成行`
    : minimum ? "已达成行人数" : "报名人数";
  const capacityLabel = [minimum ? `最低 ${minimum} 人` : "", maximum ? `最多 ${maximum} 人` : ""].filter(Boolean).join(" / ");
  const scale = maximum && maximum > 0 ? maximum : minimum && minimum > 0 ? Math.max(minimum, joined) : null;
  const progressPercent = scale ? Math.min(100, Math.max(0, joined / scale * 100)) : null;
  const targetPercent = scale && minimum ? Math.min(100, minimum / scale * 100) : null;
  const basePercent = progressPercent === null ? 0 : Math.min(progressPercent, targetPercent ?? 100);
  const extraPercent = progressPercent === null ? 0 : Math.max(0, progressPercent - basePercent);
  const belowMinimum = !!minimum && joined < minimum;
  return {
    minimum, maximum, countLabel, capacityLabel, progressPercent, targetPercent,
    basePercent, extraPercent, belowMinimum,
    minimumPercent: scale && minimum && minimum < scale ? minimum / scale * 100 : null,
  };
}
