<script setup lang="ts">
import { computed } from "vue";

export type SegmentOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

const props = withDefaults(defineProps<{
  modelValue: string;
  options: SegmentOption[];
  block?: boolean;
}>(), {
  block: true,
});

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
  (event: "change", value: string): void;
}>();

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${Math.max(props.options.length, 1)}, minmax(0, 1fr))`,
}));

// 滑动指示块：等分轨道宽度，随选中项平移（switch 动效 token 驱动，支持快速反向）。
const activeIndex = computed(() => {
  const index = props.options.findIndex((option) => option.value === props.modelValue);
  return index < 0 ? 0 : index;
});

const indicatorStyle = computed(() => ({
  width: `${100 / Math.max(props.options.length, 1)}%`,
  transform: `translateX(${activeIndex.value * 100}%)`,
}));

function handleSelect(option: SegmentOption) {
  if (option.disabled || option.value === props.modelValue) return;
  emit("update:modelValue", option.value);
  emit("change", option.value);
}
</script>

<template>
  <view
    class="ui-segmented-control"
    :class="block ? 'ui-segmented-control--block' : ''"
  >
    <view class="ui-segmented-control__track" :style="gridStyle">
      <view class="ui-segmented-control__indicator" :style="indicatorStyle" aria-hidden="true" />
      <view
        v-for="option in options"
        :key="option.value"
        class="ui-segmented-control__item"
        :class="[
          option.value === modelValue ? 'ui-segmented-control__item--active' : '',
          option.disabled ? 'ui-segmented-control__item--disabled' : '',
        ]"
        :hover-class="option.disabled ? 'none' : 'ui-segmented-control__item--pressed'"
        @tap="handleSelect(option)"
      >
        <text>{{ option.label }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.ui-segmented-control {
  display: inline-flex;
  max-width: 100%;
  padding: var(--ui-segment-padding);
  border-radius: var(--ui-segment-radius);
  background: var(--ui-segment-bg);
  box-sizing: border-box;
}

.ui-segmented-control--block {
  display: flex;
  width: 100%;
}

.ui-segmented-control__track {
  position: relative;
  display: grid;
  width: 100%;
  gap: 0;
}

.ui-segmented-control__indicator {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  border-radius: var(--ui-segment-radius);
  background: var(--ui-segment-active-bg);
  transition: transform var(--ui-motion-switch-duration) var(--ui-motion-ease-out);
}

.ui-segmented-control__item {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: var(--ui-segment-height);
  padding: 0 18rpx;
  border-radius: var(--ui-segment-radius);
  color: var(--ui-color-text-muted);
  font-size: var(--ui-segment-font-size);
  font-weight: 500;
  line-height: 1.2;
  box-sizing: border-box;
  transition: color var(--ui-motion-switch-duration) var(--ui-motion-ease-out), opacity var(--ui-motion-press-duration) ease;
}

.ui-segmented-control__item--active {
  color: var(--ui-color-text);
  font-weight: 600;
}

.ui-segmented-control__item--pressed {
  opacity: 0.72;
}

.ui-segmented-control__item--disabled {
  opacity: 0.46;
}

/* H5 减少动态效果：指示块与文字颜色直接切换（选择状态与提交逻辑不变）。 */
@media (prefers-reduced-motion: reduce) {
  .ui-segmented-control__indicator,
  .ui-segmented-control__item {
    transition: none;
  }
}
</style>
