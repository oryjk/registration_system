/**
 * 主客同制的容量规则：客队分组的成行/满员人数未配置时继承主队分组。
 * 详情页双边进度与约队大厅列表共用，规则调整只改这里。
 */
export function resolveInheritedGuestLimit(
  hostValue: number | null | undefined,
  guestValue: number | null | undefined,
): number | null {
  return guestValue ?? hostValue ?? null;
}
