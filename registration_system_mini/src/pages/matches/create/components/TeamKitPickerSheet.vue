<script setup lang="ts">
// #ifdef MP-WEIXIN
import AppIcon from "@/components/ui/AppIcon.vue";
// #endif
import { computed, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import type { SegmentOption } from "@/components/ui/SegmentedControl.vue";
import { useOverlayPresence } from "@/components/ui/useOverlayPresence";
import { prefersReducedMotion } from "@/utils/reducedMotion";
import {
  KIT_COLOR_OPTIONS,
  formatKitSummary,
  isLightKitColor,
  kitStrokeColor,
  normalizeKitColorHex,
} from "@/utils/kitColors";
import KitPieceIcons from "../../components/KitPieceIcons.vue";

type KitPart = "shirt" | "shorts" | "socks";

export interface TeamKitSelection {
  shirtColor: string;
  shortsColor: string;
  socksColor: string;
}

const props = withDefaults(
  defineProps<{
    visible: boolean;
    title: string;
    shirtColor: string;
    shortsColor?: string;
    socksColor?: string;
  }>(),
  {
    shortsColor: "",
    socksColor: "",
  },
);

const emit = defineEmits<{
  (event: "close"): void;
  (event: "confirm", value: TeamKitSelection): void;
}>();

// 底部弹层退场时序：淡出下滑期间遮罩继续拦截点击（防点穿），结束才放行。
const { rendered, leaving } = useOverlayPresence(
  computed(() => props.visible),
  { leaveDurationMs: () => (prefersReducedMotion() ? 0 : 210) },
);

const activePart = ref<KitPart>("shirt");
const draftShirt = ref("");
const draftShorts = ref("");
const draftSocks = ref("");

const partOptions: SegmentOption[] = [
  { label: "上衣", value: "shirt" },
  { label: "球裤（选填）", value: "shorts" },
  { label: "球袜（选填）", value: "socks" },
];

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    activePart.value = "shirt";
    draftShirt.value = normalizeKitColorHex(props.shirtColor) || props.shirtColor || "";
    draftShorts.value = normalizeKitColorHex(props.shortsColor) || props.shortsColor || "";
    draftSocks.value = normalizeKitColorHex(props.socksColor) || props.socksColor || "";
  },
  { immediate: true },
);

const activeColor = computed(() => {
  if (activePart.value === "shorts") return draftShorts.value;
  if (activePart.value === "socks") return draftSocks.value;
  return draftShirt.value;
});

const summaryText = computed(() =>
  formatKitSummary({
    shirt: draftShirt.value,
    shorts: draftShorts.value,
    socks: draftSocks.value,
  }),
);

function isColorSelected(hex: string): boolean {
  return normalizeKitColorHex(activeColor.value) === normalizeKitColorHex(hex);
}

function handlePartChange(value: string) {
  if (value === "shirt" || value === "shorts" || value === "socks") {
    activePart.value = value;
  }
}

function selectColor(hex: string) {
  if (activePart.value === "shorts") {
    draftShorts.value = hex;
  } else if (activePart.value === "socks") {
    draftSocks.value = hex;
  } else {
    draftShirt.value = hex;
  }
}

function clearOptionalPart() {
  if (activePart.value === "shorts") {
    draftShorts.value = "";
  } else if (activePart.value === "socks") {
    draftSocks.value = "";
  }
}

function copyShirtColor() {
  if (!draftShirt.value) return;
  if (activePart.value === "shorts") {
    draftShorts.value = draftShirt.value;
  } else if (activePart.value === "socks") {
    draftSocks.value = draftShirt.value;
  }
}

function swatchStyle(hex: string) {
  return {
    backgroundColor: hex,
    borderColor: kitStrokeColor(hex),
  };
}

function handleClose() {
  if (!rendered.value || leaving.value) return;
  emit("close");
}

function handleConfirm() {
  if (!props.visible || !rendered.value || leaving.value) return;
  emit("confirm", {
    shirtColor: draftShirt.value,
    shortsColor: draftShorts.value,
    socksColor: draftSocks.value,
  });
}
</script>

<template>
  <view
    v-if="rendered"
    :class="[
      'kit-sheet-overlay',
      rendered && !leaving ? 'kit-sheet-overlay-open' : '',
      leaving ? 'kit-sheet-overlay-closing' : '',
    ]"
    @tap="handleClose"
  >
    <view class="kit-sheet-backdrop" />
    <view class="kit-sheet-panel" @tap.stop>
      <view class="kit-sheet-head">
        <view class="kit-sheet-heading">
          <text class="kit-sheet-title">{{ title }}</text>
          <text class="kit-sheet-subtitle">球裤和球袜可选填，未设置时不显示</text>
        </view>
        <button class="kit-sheet-close" aria-label="关闭球服搭配弹层" @tap="handleClose">
          <!-- #ifdef MP-WEIXIN -->
          <AppIcon name="x" tone="muted" />
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          ×
          <!-- #endif -->
        </button>
      </view>

      <!-- 顶部实时预览 -->
      <view class="kit-sheet-preview">
        <KitPieceIcons
          :shirt-color="draftShirt"
          :shorts-color="draftShorts"
          :socks-color="draftSocks"
          size="lg"
        />
        <text class="kit-sheet-summary">{{ summaryText }}</text>
      </view>

      <!-- 3 个分段切签 -->
      <view class="kit-sheet-segments">
        <SegmentedControl
          :model-value="activePart"
          :options="partOptions"
          @change="handlePartChange"
        />
      </view>

      <!-- 球裤 / 球袜快捷操作 -->
      <view v-if="activePart !== 'shirt'" class="kit-sheet-quick-actions">
        <view
          :class="['kit-quick-chip', !activeColor ? 'kit-quick-chip--active' : '']"
          hover-class="kit-quick-chip--pressed"
          @tap="clearOptionalPart"
        >
          <text>不设置</text>
        </view>
        <view
          :class="[
            'kit-quick-chip',
            draftShirt && normalizeKitColorHex(activeColor) === normalizeKitColorHex(draftShirt)
              ? 'kit-quick-chip--active'
              : '',
          ]"
          hover-class="kit-quick-chip--pressed"
          @tap="copyShirtColor"
        >
          <text>同上衣颜色</text>
        </view>
      </view>

      <!-- 14 色板网格 -->
      <view class="kit-swatch-grid">
        <view
          v-for="option in KIT_COLOR_OPTIONS"
          :key="option.value"
          :class="['kit-swatch-item', isColorSelected(option.value) ? 'kit-swatch-item--active' : '']"
          hover-class="kit-swatch-item--pressed"
          @tap="selectColor(option.value)"
        >
          <view class="kit-swatch-chip" :style="swatchStyle(option.value)">
            <text
              v-if="isColorSelected(option.value)"
              :class="['kit-swatch-check', isLightKitColor(option.value) ? 'kit-swatch-check--dark' : 'kit-swatch-check--light']"
            >
              ✓
            </text>
          </view>
          <text class="kit-swatch-name">{{ option.name }}</text>
        </view>
      </view>

      <view class="kit-sheet-footer">
        <view class="kit-sheet-confirm">
          <AppButton block variant="lime" @click="handleConfirm">完成搭配</AppButton>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.kit-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 140;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--ui-motion-overlay-duration) ease;
}

.kit-sheet-overlay-open {
  opacity: 1;
  pointer-events: auto;
}

.kit-sheet-overlay-closing {
  opacity: 0;
  pointer-events: auto;
}

.kit-sheet-backdrop {
  position: absolute;
  inset: 0;
  background: var(--ui-color-overlay);
}

.kit-sheet-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  box-sizing: border-box;
  max-height: 86vh;
  overflow-y: auto;
  padding: var(--ui-space-7) var(--ui-page-padding-inline, 28rpx) calc(var(--ui-space-7) + env(safe-area-inset-bottom));
  border-top-left-radius: var(--ui-card-radius, 36rpx);
  border-top-right-radius: var(--ui-card-radius, 36rpx);
  background: var(--ui-color-surface);
  transform: translateY(100%);
  transition: transform var(--ui-motion-overlay-duration) var(--ui-motion-ease-out);
}

.kit-sheet-overlay-open .kit-sheet-panel {
  transform: translateY(0);
}

.kit-sheet-overlay-closing .kit-sheet-panel {
  pointer-events: none;
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .kit-sheet-overlay,
  .kit-sheet-panel {
    transition: none;
  }
}

.kit-sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-space-4);
}

.kit-sheet-heading {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.kit-sheet-title {
  color: var(--ui-color-text);
  font-size: var(--ui-text-title, 34rpx);
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.3;
}

.kit-sheet-subtitle {
  color: var(--ui-color-text-secondary, var(--ui-color-text-muted));
  font-size: var(--ui-text-sm, 22rpx);
  line-height: 1.45;
}

.kit-sheet-close {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--ui-control-min-height, 72rpx);
  height: var(--ui-control-min-height, 72rpx);
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ui-color-text-muted);
  font-size: 40rpx;
  line-height: 1;
}

.kit-sheet-close::after { border: 0; }

.kit-sheet-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  margin-top: var(--ui-space-5, 24rpx);
  padding: 28rpx 20rpx;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-neutral-bg);
}

.kit-sheet-summary {
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.4;
}

.kit-sheet-segments {
  margin-top: var(--ui-space-5, 24rpx);
}

.kit-sheet-quick-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 20rpx;
}

.kit-quick-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 60rpx;
  padding: 0 22rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-surface);
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 500;
  transition: background-color var(--ui-motion-press-duration) var(--ui-motion-ease-out);
}

.kit-quick-chip--active {
  border-color: var(--ui-color-accent);
  background: var(--ui-color-accent-soft);
  color: var(--ui-color-text);
  font-weight: var(--ui-font-weight-heading);
}

.kit-quick-chip--pressed {
  box-shadow: var(--ui-shadow-control-pressed);
}

.kit-swatch-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 18rpx 12rpx;
  margin-top: 22rpx;
}

.kit-swatch-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 4rpx;
  border: 2rpx solid transparent;
  border-radius: 16rpx;
  box-sizing: border-box;
  transition:
    transform var(--ui-motion-press-duration) var(--ui-motion-ease-out),
    background-color var(--ui-motion-press-duration) var(--ui-motion-ease-out);
}

.kit-swatch-item--active {
  border-color: var(--ui-color-accent);
  background: var(--ui-color-accent-subtle);
}

.kit-swatch-item--pressed {
  transform: scale(0.95);
}

.kit-swatch-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68rpx;
  height: 54rpx;
  border-width: 2rpx;
  border-style: solid;
  border-radius: 14rpx;
  box-sizing: border-box;
}

.kit-swatch-check {
  font-size: 26rpx;
  font-weight: var(--ui-font-weight-heading);
  line-height: 1;
}

.kit-swatch-check--dark {
  color: var(--ui-color-text);
}

.kit-swatch-check--light {
  color: var(--ui-color-text-inverse);
}

.kit-swatch-name {
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  line-height: 1.25;
}

.kit-swatch-item--active .kit-swatch-name {
  color: var(--ui-color-text);
  font-weight: var(--ui-font-weight-heading);
}

.kit-sheet-footer {
  display: flex;
  flex-direction: column;
  margin-top: 28rpx;
}

.kit-sheet-confirm {
  width: 100%;
}
</style>
