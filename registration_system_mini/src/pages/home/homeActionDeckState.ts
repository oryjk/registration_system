/** 只接受明确的横向翻卡；纵向与斜向滑动留给页面滚动。 */
export function resolveDeckSwipe(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy) * 1.3) return 0;
  return dx < 0 ? 1 : -1;
}

export function deckBoundaryMessage(index: number, count: number, step: number): string {
  if (count <= 0 || step === 0) return "";
  if (index + step < 0) return "已经是最早的比赛了";
  if (index + step >= count) return "没有更多的比赛了";
  return "";
}

/** 先锁定方向，已经开始纵向滚动时不改判为翻卡。 */
export function resolveDeckAxis(dx: number, dy: number): 'pending' | 'horizontal' | 'vertical' {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return 'pending';
  return Math.abs(dx) > Math.abs(dy) * 1.3 ? 'horizontal' : 'vertical';
}

/** 正常拖动一比一跟手，首尾越界增加阻尼并限制距离。 */
export function deckDragOffset(dx: number, index: number, count: number): number {
  const step = dx < 0 ? 1 : -1;
  return deckBoundaryMessage(index, count, step)
    ? Math.sign(dx) * Math.min(48, Math.abs(dx) * 0.22)
    : dx;
}
