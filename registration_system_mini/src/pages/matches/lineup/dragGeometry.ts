import { computed, nextTick, reactive } from "vue";

/**
 * 球场拖动的几何尺寸：与 design-tokens.css 中的 --ui-lineup-dot-* 保持一致。
 * movable-view 的 x/y 与 createSelectorQuery 只接受 px，对外释放判定统一换算为 rpx。
 */
export const DOT_DIAMETER_RPX = 80;
export const DOT_BOX_WIDTH_RPX = 124;
export const DOT_BOX_HEIGHT_RPX = 152;

export interface Px {
  x: number;
  y: number;
}

const toPx = (rpx: number, windowWidthPx: number) => (rpx * windowWidthPx) / 750;
const toRpx = (px: number, windowWidthPx: number) => (px * 750) / windowWidthPx;

/**
 * 计算某个槽位在球场里应绑定的 movable-view 左上角（px），使头像圆点中心落在 (x, y) 处。
 * 必须钳制在 movable-area 内，防止贴边位置被原生拉回 0 后造成轻点被误判为拖动。
 */
export function boxPositionPx(
  entry: { x: number; y: number },
  field: { width: number; height: number },
  windowWidthPx: number,
): Px {
  const boxW = toPx(DOT_BOX_WIDTH_RPX, windowWidthPx);
  const boxH = toPx(DOT_BOX_HEIGHT_RPX, windowWidthPx);
  const dot = toPx(DOT_DIAMETER_RPX, windowWidthPx);
  const x = entry.x * field.width - boxW / 2;
  const y = entry.y * field.height - dot / 2;
  return {
    x: Math.min(Math.max(0, x), Math.max(0, field.width - boxW)),
    y: Math.min(Math.max(0, y), Math.max(0, field.height - boxH)),
  };
}

/** movable-view 左上角（px）对应的圆点中心（rpx，相对球场左上角）。 */
export function boxCentreRpx(position: Px, windowWidthPx: number): Px {
  const boxW = toPx(DOT_BOX_WIDTH_RPX, windowWidthPx);
  const dot = toPx(DOT_DIAMETER_RPX, windowWidthPx);
  return {
    x: toRpx(position.x + boxW / 2, windowWidthPx),
    y: toRpx(position.y + dot / 2, windowWidthPx),
  };
}

/**
 * 松手后强制重新绑定：互换时被拖的点位提交后的坐标与拖动前相同，绑定值没变，
 * 小程序运行时不会下发 setData，movable-view 会停在松手处。先覆盖为松手位置，
 * 下一个 tick 再删掉覆盖，原生层才会平滑移回已提交位置。
 */
export function useDragRebind(target: () => Record<number, Px>) {
  const override = reactive<Record<number, Px>>({});
  const bound = computed<Record<number, Px>>(() => ({ ...target(), ...override }));

  async function release(slot: number, livePx: Px): Promise<void> {
    override[slot] = livePx;
    await nextTick();
    delete override[slot];
  }

  return { bound, release };
}
