<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  value: number;
  max: number;
  target?: number;
  label?: string;
  valueText?: string;
  showMeta?: boolean;
}>(), {
  target: undefined,
  label: "",
  valueText: "",
  showMeta: true,
});

const safeMax = computed(() => Math.max(Number.isFinite(props.max) ? props.max : 0, 1));
const safeTarget = computed(() => {
  const target = props.target ?? safeMax.value;
  return Math.min(Math.max(Number.isFinite(target) ? target : safeMax.value, 0), safeMax.value);
});
const safeValue = computed(() => (
  Math.min(Math.max(Number.isFinite(props.value) ? props.value : 0, 0), safeMax.value)
));
const baseWidth = computed(() => `${(Math.min(safeValue.value, safeTarget.value) / safeMax.value) * 100}%`);
const extraWidth = computed(() => `${(Math.max(safeValue.value - safeTarget.value, 0) / safeMax.value) * 100}%`);
const splitLeft = computed(() => `${(safeTarget.value / safeMax.value) * 100}%`);
const shouldShowExtra = computed(() => safeValue.value > safeTarget.value);
const shouldShowSplit = computed(() => safeTarget.value < safeMax.value);
const displayValue = computed(() => (
  props.valueText || `${props.value}/${props.target ?? props.max}`
));
</script>

<template>
  <view class="neo-progress">
    <view v-if="showMeta" class="neo-progress__meta">
      <text class="neo-progress__label">{{ label }}</text>
      <text class="neo-progress__value">{{ displayValue }}</text>
    </view>
    <view class="neo-progress__track">
      <view class="neo-progress__fill" :style="{ width: baseWidth }" />
      <view
        v-if="shouldShowExtra"
        class="neo-progress__extra"
        :style="{ left: splitLeft, width: extraWidth }"
      />
      <view
        v-if="shouldShowSplit"
        class="neo-progress__split"
        :style="{ left: splitLeft }"
      />
    </view>
  </view>
</template>

<style scoped>
.neo-progress {
  width: 100%;
}

.neo-progress__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--neo-color-text);
  font-size: var(--neo-progress-meta-font-size);
  font-weight: var(--neo-progress-meta-font-weight);
}

.neo-progress__track {
  position: relative;
  width: 100%;
  height: var(--neo-progress-height);
  margin-top: var(--neo-progress-track-margin-top);
  border: var(--neo-border-default);
  border-radius: var(--neo-progress-radius);
  background: var(--neo-progress-track-bg);
  overflow: hidden;
  box-sizing: border-box;
}

.neo-progress__fill,
.neo-progress__extra {
  position: absolute;
  top: 0;
  height: 100%;
}

.neo-progress__fill {
  left: 0;
  background: var(--neo-progress-fill-bg);
}

.neo-progress__extra {
  background: var(--neo-progress-extra-bg);
}

.neo-progress__split {
  position: absolute;
  top: -2rpx;
  width: 3rpx;
  height: var(--neo-progress-height);
  background: var(--neo-progress-split-bg);
  transform: translateX(-50%);
}
</style>
