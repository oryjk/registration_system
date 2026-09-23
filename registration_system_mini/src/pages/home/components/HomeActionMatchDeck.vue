<script setup lang="ts">
import HomeSectionHeader from "./HomeSectionHeader.vue";
import { computed, nextTick, onUnmounted, ref } from "vue";
import { prefersReducedMotion } from '@/utils/reducedMotion';
import { resolveDeckSwipe, deckBoundaryMessage, resolveDeckAxis, deckDragOffset } from '../homeActionDeckState';
const props = defineProps<{ index: number; count: number }>();
const emit = defineEmits<{
  (event: 'change', index: number): void;
  (event: 'interaction', blocked: boolean): void;
}>();
type Point = { clientX: number; clientY: number };
const offset = ref(0);
const dragging = ref(false);
// 拖动跟手，内容交接时两层同步无动画复位，避免新卡再次缩放。
const fingerDragging = ref(false);
const settling = ref(false);
const resetting = ref(false);
// 单一时序源同时驱动 CSS 和交接计时；底卡比离场卡多留一段柔和落位。
const deckMotion = { exit: 280, settle: 420, return: 300, land: 180 } as const;
const settleDuration = ref<number>(deckMotion.settle);
const exitDuration = ref<number>(deckMotion.exit);
const liftProgress = ref(0);
const landingOffset = ref(0);
let disposed = false;
let gestureWidth = 1;
// 边界方向的拖动（该方向已无相邻比赛）：背层实卡淡出，避免把另一侧的比赛误露成“这个方向还有卡”。
const overDrag = ref(false);
const revealPrevious = computed(() => props.index === props.count - 1 || (offset.value > 0 && props.index > 0));
// 内联样式里的 rpx 在 H5 不会换算，浏览器按非法单位丢弃整条 transform；统一换算成 px（小程序上与 rpx 等价）。
const deckLiftPx = uni.upx2px(32);
const deckLandingPx = uni.upx2px(8);
const deckShiftPx = uni.upx2px(10);
const underStyle = computed(() => {
  const progress = liftProgress.value;
  return {
    transform: `translate(${deckShiftPx * (1 - progress)}px, ${deckLiftPx * (1 - progress) + deckLandingPx * progress}px) rotate(${1.4 * (1 - progress)}deg) scale(${0.95 + 0.05 * progress})`,
    '--deck-tint-opacity': String(0.72 * (1 - progress)),
  };
});
const frontStyle = computed(() => ({
  transform: `translate3d(${offset.value}px, ${landingOffset.value}px, 0) rotate(${Math.max(-6, Math.min(6, offset.value / 35))}deg)`,
  opacity: settling.value && Math.abs(offset.value) > 200 ? 0 : 1,
}));
let origin: Point | null = null;
let axis: 'pending' | 'horizontal' | 'vertical' = 'pending';
let timer: ReturnType<typeof setTimeout> | undefined;
let lastBoundaryToastAt = 0;
function release() {
  offset.value = 0;
  landingOffset.value = 0;
  liftProgress.value = 0;
  dragging.value = false;
  fingerDragging.value = false;
  overDrag.value = false;
  settling.value = false;
  resetting.value = false;
  emit('interaction', false);
}
function rebound() {
  fingerDragging.value = false;
  overDrag.value = false;
  dragging.value = false;
  settling.value = true;
  settleDuration.value = prefersReducedMotion() ? 0 : deckMotion.return;
  exitDuration.value = settleDuration.value;
  liftProgress.value = 0;
  offset.value = 0;
  timer = setTimeout(release, settleDuration.value);
}
function change(step: number) {
  if (settling.value || !props.count || !step) return;
  emit('interaction', true);
  fingerDragging.value = false;
  overDrag.value = false;
  const message = deckBoundaryMessage(props.index, props.count, step);
  if (message) {
    const now = Date.now();
    if (now - lastBoundaryToastAt >= 1600) {
      lastBoundaryToastAt = now;
      uni.showToast({ title: message, icon: 'none', duration: 1500 });
    }
    rebound();
    return;
  }
  const next = props.index + step;
  gestureWidth = Math.max(1, uni.getWindowInfo().windowWidth);
  const reduced = prefersReducedMotion();
  settleDuration.value = reduced ? 0 : deckMotion.settle;
  exitDuration.value = reduced ? 0 : deckMotion.exit;
  liftProgress.value = 1;
  dragging.value = false;
  settling.value = true;
  offset.value = -step * gestureWidth;
  timer = setTimeout(async () => {
    // 背卡保留最后 8rpx 的上移；主卡先在同一位置接替，再连续完成落位。
    resetting.value = true;
    dragging.value = true;
    offset.value = 0;
    landingOffset.value = reduced ? 0 : deckLandingPx;
    liftProgress.value = 0;
    emit('change', Math.max(0, Math.min(next, props.count - 1)));
    await nextTick();
    if (disposed) return;
    // 先提交同位置交接，再启用过渡；保持交互锁直至最后的上移完成。
    timer = setTimeout(() => {
      dragging.value = false;
      exitDuration.value = reduced ? 0 : deckMotion.land;
      landingOffset.value = 0;
      timer = setTimeout(release, exitDuration.value);
    }, reduced ? 0 : 32);
  }, settleDuration.value);
}
function start(event: { touches: ArrayLike<Point>; target?: unknown }) {
  // 头像区域由内部 scroll-view 处理滚动与点击，不拦截其原生触摸事件。
  const target = event.target as { dataset?: { deckIgnore?: string | boolean } } | null;
  const ignore = target?.dataset?.deckIgnore;
  if (ignore === true || ignore === "true") { origin = null; return; }
  if (settling.value || dragging.value || event.touches.length !== 1) return;
  gestureWidth = Math.max(1, uni.getWindowInfo().windowWidth);
  const point = event.touches[0];
  origin = point ? { clientX: point.clientX, clientY: point.clientY } : null;
  axis = 'pending';
}
function move(event: { touches: ArrayLike<Point> }) {
  if (!origin) return;
  if (event.touches.length !== 1) { cancel(); return; }
  const point = event.touches[0];
  if (!point) return;
  const dx = point.clientX - origin.clientX;
  const dy = point.clientY - origin.clientY;
  if (axis === 'pending') axis = resolveDeckAxis(dx, dy);
  if (axis !== 'horizontal') return;
  if (!dragging.value) emit('interaction', true);
  dragging.value = true;
  fingerDragging.value = true;
  overDrag.value = !!deckBoundaryMessage(props.index, props.count, dx < 0 ? 1 : -1);
  offset.value = deckDragOffset(dx, props.index, props.count);
  // 手势只完成部分浮起，余下行程留给松手落位；按屏宽归一化，避免 140px 就顶满。
  liftProgress.value = overDrag.value ? 0 : Math.min(0.65, Math.abs(offset.value) / gestureWidth);
}
function end(event: { changedTouches: ArrayLike<Point> }) {
  if (!origin) return;
  const point = event.changedTouches[0];
  const dx = point ? point.clientX - origin.clientX : 0;
  const dy = point ? point.clientY - origin.clientY : 0;
  origin = null;
  if (axis === 'vertical') return;
  const step = resolveDeckSwipe(dx, dy);
  if (step) change(step);
  else if (dragging.value) rebound();
}
function cancel() {
  origin = null;
  if (dragging.value && !settling.value) rebound();
}
onUnmounted(() => {
  if (timer) clearTimeout(timer);
  disposed = true;
  emit('interaction', false);
});
</script>

<template>
  <view class="action-deck" :style="{ '--deck-settle-duration': `${settleDuration}ms`, '--deck-exit-duration': `${exitDuration}ms` }">
    <view class="deck-control" @touchstart="start" @touchmove="move" @touchend="end" @touchcancel="cancel">
      <HomeSectionHeader title="最近要处理">
        <template #meta><text v-if="count > 1" class="deck-position">{{ index + 1 }} / {{ count }}</text></template>
        <template #actions><view v-if="count > 1" class="deck-actions">
        <button aria-label="上一场比赛" :disabled="index === 0 || settling || dragging" @tap.stop="change(-1)"><wd-icon name="arrow-left" size="30rpx" /></button>
        <button aria-label="下一场比赛" :disabled="index === count - 1 || settling || dragging" @tap.stop="change(1)"><wd-icon name="arrow-right" size="30rpx" /></button>
        </view></template>
      </HomeSectionHeader>
    </view>
    <view class="deck-stack" :class="{ 'deck-stack--multiple': count > 1 }">
      <view v-if="count > 2" class="deck-back deck-back--far" />
      <view v-if="count > 1" class="deck-under" :class="{ 'deck-under--dragging': fingerDragging, 'deck-under--resetting': resetting, 'deck-under--empty': overDrag }" :style="underStyle" aria-hidden="true" inert>
        <view v-show="revealPrevious"><slot name="previous" /></view>
        <view v-show="!revealPrevious"><slot name="next" /></view>
      </view>
      <view class="deck-front" :class="{ 'deck-front--dragging': dragging, 'deck-front--settling': settling }" :style="frontStyle" @touchstart="start" @touchmove="move" @touchend="end" @touchcancel="cancel"><slot /></view>
    </view>
  </view>
</template>

<style scoped>
.action-deck { overflow: hidden; }
.deck-control { touch-action: pan-y; }
.deck-control :deep(.home-section-header) { margin-top: 0; }
.deck-position { font-size: 22rpx; color: var(--now-color-muted); }
.deck-actions { display: flex; gap: 12rpx; }
.deck-actions button { display: flex; align-items: center; justify-content: center; margin: 0; padding: 0; width: 64rpx; height: 64rpx; line-height: 64rpx; border-radius: 50%; background: var(--now-color-soft); color: var(--now-color-accent-text); font-size: 30rpx; }
.deck-actions button::after { border: 0; }
.deck-actions button[disabled] { opacity: 0.3; }
.deck-stack { position: relative; }
.deck-stack--multiple { padding: 0 8rpx 58rpx; }
.deck-back { position: absolute; inset: 18rpx 8rpx 58rpx; border: 0; border-radius: var(--now-radius-card); background: var(--now-deck-near); box-shadow: var(--now-shadow); pointer-events: none; transform-origin: center bottom; }
.deck-back--far { transform: translate(16rpx, 48rpx) rotate(2deg) scale(0.92); background: var(--now-deck-far); }
.deck-under { position: absolute; top: 0; left: 8rpx; right: 8rpx; bottom: 58rpx; overflow: hidden; border-radius: var(--now-radius-card); pointer-events: none; transform-origin: center bottom; transition: transform var(--deck-settle-duration) var(--ui-motion-ease-out), opacity 180ms ease; will-change: transform; }
/* 色层只覆盖预览卡，随浮起淡出；两张比赛时也能看清牌堆边缘。 */
.deck-under::after { content: ''; position: absolute; inset: 18rpx 0 0; border-radius: var(--now-radius-card); background: var(--now-deck-near); box-shadow: none; opacity: var(--deck-tint-opacity); pointer-events: none; transition: opacity var(--deck-settle-duration) var(--ui-motion-ease-out); }
.deck-under--dragging::after, .deck-under--resetting::after { transition: none; }
/* 手指拖动时背层 transform 必须跟手；边界拖动反向拖回时实卡平滑淡入。 */
.deck-under--dragging { transition: opacity 180ms ease; }
/* 边界方向的拖动：实卡必须与主卡位移同帧隐藏（快速轻扫时淡出会先露出内容）；淡入走上面的过渡。 */
.deck-under--empty { transition: none; opacity: 0; }
/* flex 容器阻止卡片顶部 margin 折叠，与 overflow:hidden 的预览层保持同一坐标。 */
.deck-front { display: flex; flex-direction: column; position: relative; transform-origin: bottom center; transition: transform var(--deck-exit-duration) var(--ui-motion-ease-out), opacity var(--deck-exit-duration) ease; will-change: transform; }
.deck-front--dragging { transition: none; }
.deck-front--settling { pointer-events: none; }
.deck-under--resetting { transition: none; }
@media (prefers-reduced-motion: reduce) {
  .deck-front, .deck-under, .deck-under::after { transition: none; }
}
</style>
