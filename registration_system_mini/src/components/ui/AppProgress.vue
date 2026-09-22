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

// value 超过 max（报名超额且未配置容量上限）时，刻度扩展到 value，
// 保证阈值分割线可见、超出部分以 extra 段呈现，与各卡片用法风格一致。
const rawValue = computed(() => Math.max(Number.isFinite(props.value) ? props.value : 0, 0));
const safeMax = computed(() => Math.max(Number.isFinite(props.max) ? props.max : 0, rawValue.value, 1));
const safeTarget = computed(() => {
  const target = props.target ?? safeMax.value;
  return Math.min(Math.max(Number.isFinite(target) ? target : safeMax.value, 0), safeMax.value);
});
const safeValue = computed(() => Math.min(rawValue.value, safeMax.value));
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
  <view class="ui-progress">
    <view v-if="showMeta" class="ui-progress__meta">
      <text class="ui-progress__label">{{ label }}</text>
      <text class="ui-progress__value">{{ displayValue }}</text>
    </view>
    <view class="ui-progress__track">
      <view class="ui-progress__fill" :style="{ width: baseWidth }" />
      <view
        v-if="shouldShowExtra"
        class="ui-progress__extra"
        :style="{ left: splitLeft, width: extraWidth }"
      />
      <view
        v-if="shouldShowSplit"
        class="ui-progress__split"
        :style="{ left: splitLeft }"
      />
    </view>
  </view>
</template>

<style scoped>
.ui-progress {
  width: 100%;
}

.ui-progress__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--ui-color-text);
  font-size: var(--ui-progress-meta-font-size);
  font-weight: var(--ui-progress-meta-font-weight);
}

.ui-progress__track {
  position: relative;
  width: 100%;
  height: var(--ui-progress-height);
  margin-top: var(--ui-progress-track-margin-top);
  border-radius: var(--ui-progress-radius);
  background: var(--ui-progress-track-bg);
  overflow: hidden;
  box-sizing: border-box;
}

.ui-progress__fill,
.ui-progress__extra {
  position: absolute;
  top: 0;
  height: 100%;
  transition: width var(--ui-motion-progress-duration) ease, left var(--ui-motion-progress-duration) ease, background-color var(--ui-motion-progress-duration) ease;
}

.ui-progress__fill {
  left: 0;
  background: var(--ui-progress-fill-bg);
}

.ui-progress__extra {
  background: var(--ui-progress-extra-bg);
}

.ui-progress__split {
  position: absolute;
  top: 0;
  width: 3rpx;
  height: 100%;
  background: var(--ui-progress-split-bg);
  transform: translateX(-50%);
}

/* H5 减少动态效果：进度直接呈现真实值，不做平滑过渡。 */
@media (prefers-reduced-motion: reduce) {
  .ui-progress__fill,
  .ui-progress__extra {
    transition: none;
  }
}
</style>
