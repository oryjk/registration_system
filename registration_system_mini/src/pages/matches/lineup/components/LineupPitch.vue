<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import type { PitchSlotView } from "@/types/lineup";
import {
  boxCentreRpx,
  boxPositionPx,
  DOT_DIAMETER_RPX,
  useDragRebind,
  type Px,
} from "../dragGeometry";
import { resolveDragRelease, type DragOutcome } from "../helpers";
import LineupPlayerDot from "./LineupPlayerDot.vue";

interface MovableChangeEvent {
  detail: { x: number; y: number; source?: string };
}

const props = withDefaults(
  defineProps<{
    players: PitchSlotView[];
    readonly?: boolean;
    selectedSlot?: number | null;
    currentUserId?: number | null;
  }>(),
  {
    readonly: false,
    selectedSlot: null,
    currentUserId: null,
  },
);

const emit = defineEmits<{
  (event: "tap", slot: number): void;
  (event: "drag", slot: number, outcome: DragOutcome): void;
}>();

const instance = getCurrentInstance();
const measured = ref(false);
const areaReady = ref(false);
const fieldPx = reactive({ width: 0, height: 0 });
const windowWidthPx = ref(375);

const MEASURE_RETRIES = 6;
const MEASURE_RETRY_MS = 120;
let measureEpoch = 0;
let measureTimer: ReturnType<typeof setTimeout> | null = null;
let disposed = false;

// 原生 movable-area 必须先用真实 px 尺寸挂载并确认布局完成，再渲染 movable-view，
// 防止微信把尚未布局完成的区域内所有 x/y 归零叠在左上角。
const areaStyle = computed(() => ({
  width: `${fieldPx.width}px`,
  height: `${fieldPx.height}px`,
}));

const visiblePlayers = computed(() => (areaReady.value ? props.players : []));

const position = computed<Record<number, Px>>(() => {
  const result: Record<number, Px> = {};
  if (!measured.value) return result;
  for (const entry of props.players) {
    result[entry.slot] = boxPositionPx(entry, fieldPx, windowWidthPx.value);
  }
  return result;
});

const { bound, release } = useDragRebind(() => position.value);

// 非响应式拖动轨迹，避免与原生 movable-view 双向回写打架。
const live: Record<number, Px> = {};
const pressedFrom: Record<number, Px> = {};
let suppressTap = false;

function readWindowWidth(): number {
  const readers = [
    () => uni.getWindowInfo?.().windowWidth,
    () => uni.upx2px(750),
    () => uni.getSystemInfoSync().windowWidth,
  ];
  for (const read of readers) {
    try {
      const width = read();
      if (typeof width === "number" && Number.isFinite(width) && width > 0) return width;
    } catch {
      // 尝试下一个来源
    }
  }
  return windowWidthPx.value;
}

function isCurrentMeasure(epoch: number): boolean {
  return !disposed && epoch === measureEpoch;
}

function retryMeasure(epoch: number, action: () => void): void {
  if (!isCurrentMeasure(epoch)) return;
  if (measureTimer) clearTimeout(measureTimer);
  measureTimer = setTimeout(() => {
    measureTimer = null;
    if (isCurrentMeasure(epoch)) action();
  }, MEASURE_RETRY_MS);
}

function measureArea(epoch: number, attempt = 0): void {
  if (!instance || !isCurrentMeasure(epoch)) return;
  uni
    .createSelectorQuery()
    .in(instance)
    .select(".pitch__area")
    .boundingClientRect((rect) => {
      if (!isCurrentMeasure(epoch)) return;
      const box = Array.isArray(rect) ? rect[0] : rect;
      if (
        box &&
        box.width &&
        box.height &&
        Math.abs(box.width - fieldPx.width) < 1 &&
        Math.abs(box.height - fieldPx.height) < 1
      ) {
        areaReady.value = true;
        return;
      }
      if (attempt < MEASURE_RETRIES) {
        retryMeasure(epoch, () => measureArea(epoch, attempt + 1));
      }
    })
    .exec();
}

function measure(attempt = 0, epoch = ++measureEpoch): void {
  if (!isCurrentMeasure(epoch)) return;
  windowWidthPx.value = readWindowWidth();
  if (!instance) return;
  uni
    .createSelectorQuery()
    .in(instance)
    .select("#lineup-pitch-field")
    .boundingClientRect((rect) => {
      if (!isCurrentMeasure(epoch)) return;
      const box = Array.isArray(rect) ? rect[0] : rect;
      if (box && box.width && box.height) {
        if (areaReady.value && fieldPx.width === box.width && fieldPx.height === box.height) return;
        areaReady.value = false;
        fieldPx.width = box.width;
        fieldPx.height = box.height;
        measured.value = true;
        void nextTick(() => measureArea(epoch));
        return;
      }
      if (attempt < MEASURE_RETRIES) {
        retryMeasure(epoch, () => measure(attempt + 1, epoch));
      }
    })
    .exec();
}

const onResize = () => measure();

onMounted(() => {
  void nextTick(() => measure());
  uni.onWindowResize?.(onResize);
});

onBeforeUnmount(() => {
  disposed = true;
  measureEpoch += 1;
  if (measureTimer) clearTimeout(measureTimer);
  uni.offWindowResize?.(onResize);
});

watch(
  () => props.players.length,
  () => {
    void nextTick(() => measure());
  },
);

function onStart(slot: number): void {
  if (props.readonly) return;
  const origin = position.value[slot];
  if (!origin) return;
  pressedFrom[slot] = { ...origin };
  live[slot] = { ...origin };
}

function onChange(slot: number, event: MovableChangeEvent): void {
  if (event.detail.source === "touch" || event.detail.source === "touch-out-of-bounds") {
    live[slot] = { x: event.detail.x, y: event.detail.y };
  }
}

function onEnd(slot: number): void {
  if (props.readonly) return;
  const from = pressedFrom[slot];
  const to = live[slot];
  delete pressedFrom[slot];
  delete live[slot];
  if (!from || !to) return;

  const rpxPerPx = 750 / windowWidthPx.value;
  const fromCentre = boxCentreRpx(from, windowWidthPx.value);
  const toCentre = boxCentreRpx(to, windowWidthPx.value);

  const outcome = resolveDragRelease({
    slot,
    fromX: fromCentre.x,
    fromY: fromCentre.y,
    toX: toCentre.x,
    toY: toCentre.y,
    areaWidthRpx: fieldPx.width * rpxPerPx,
    areaHeightRpx: fieldPx.height * rpxPerPx,
    dotDiameterRpx: DOT_DIAMETER_RPX,
    slots: props.players.map((p) => ({ slot: p.slot, x: p.x, y: p.y })),
  });

  // 无论点击、微调还是互换，均执行强制重绑防止微信坐标残留。
  void release(slot, to);

  if (outcome.kind === "tap") return;

  suppressTap = true;
  setTimeout(() => {
    suppressTap = false;
  }, 0);
  emit("drag", slot, outcome);
}

function onTap(slot: number): void {
  if (props.readonly || suppressTap) return;
  emit("tap", slot);
}
</script>

<template>
  <view class="pitch">
    <view id="lineup-pitch-field" class="pitch__field">
      <view
        v-for="stripe in 8"
        :key="stripe"
        class="pitch__stripe"
        :class="{ 'pitch__stripe--alt': stripe % 2 === 0 }"
      />
      <view class="pitch__line pitch__line--outline" />
      <view class="pitch__line pitch__line--half" />
      <view class="pitch__circle" />
      <view class="pitch__box pitch__box--top" />
      <view class="pitch__box pitch__box--bottom" />

      <movable-area v-if="measured" class="pitch__area" :style="areaStyle">
        <movable-view
          v-for="entry in visiblePlayers"
          :key="entry.slot"
          class="pitch__mover"
          direction="all"
          :x="bound[entry.slot]?.x ?? 0"
          :y="bound[entry.slot]?.y ?? 0"
          :inertia="false"
          :out-of-bounds="false"
          :damping="40"
          :disabled="readonly"
          @change="(event: MovableChangeEvent) => onChange(entry.slot, event)"
          @touchstart="() => onStart(entry.slot)"
          @touchend="() => onEnd(entry.slot)"
          @tap="() => onTap(entry.slot)"
        >
          <LineupPlayerDot
            :entry="entry"
            :selected="selectedSlot === entry.slot"
            :current-user-id="currentUserId"
            :readonly="readonly"
          />
        </movable-view>
      </movable-area>
    </view>
  </view>
</template>

<style scoped>
.pitch {
  width: 100%;
}

.pitch__field {
  position: relative;
  width: 100%;
  height: 0;
  padding-top: var(--ui-lineup-pitch-ratio);
  overflow: hidden;
  border-radius: var(--ui-radius-card);
  background: var(--ui-lineup-grass);
  box-shadow: var(--ui-shadow-card);
}

.pitch__stripe {
  position: absolute;
  left: 0;
  right: 0;
  height: 12.5%;
  background: var(--ui-lineup-grass);
}

.pitch__stripe--alt {
  background: var(--ui-lineup-grass-alt);
}

.pitch__stripe:nth-child(1) { top: 0; }
.pitch__stripe:nth-child(2) { top: 12.5%; }
.pitch__stripe:nth-child(3) { top: 25%; }
.pitch__stripe:nth-child(4) { top: 37.5%; }
.pitch__stripe:nth-child(5) { top: 50%; }
.pitch__stripe:nth-child(6) { top: 62.5%; }
.pitch__stripe:nth-child(7) { top: 75%; }
.pitch__stripe:nth-child(8) { top: 87.5%; }

.pitch__line {
  position: absolute;
  border: 2rpx solid var(--ui-lineup-markings);
  box-sizing: border-box;
  pointer-events: none;
}

.pitch__line--outline {
  top: 2.5%;
  right: 3%;
  bottom: 2.5%;
  left: 3%;
  border-radius: 12rpx;
}

.pitch__line--half {
  top: 50%;
  right: 3%;
  left: 3%;
  height: 0;
  border-width: 2rpx 0 0;
}

.pitch__circle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24%;
  height: 18%;
  border: 2rpx solid var(--ui-lineup-markings);
  border-radius: var(--ui-radius-round);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.pitch__box {
  position: absolute;
  left: 26%;
  width: 48%;
  height: 13.5%;
  border: 2rpx solid var(--ui-lineup-markings);
  pointer-events: none;
}

.pitch__box--top {
  top: 2.5%;
  border-top: 0;
}

.pitch__box--bottom {
  bottom: 2.5%;
  border-bottom: 0;
}

/* movable-area 必须显式给宽高，防止微信默认 10x10 收缩导致所有点位叠在左上角。 */
.pitch__area {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.pitch__mover {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: var(--ui-lineup-dot-box-width);
  height: var(--ui-lineup-dot-box-height);
}
</style>
