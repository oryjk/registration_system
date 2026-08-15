<script setup lang="ts">
import { computed } from "vue";

export type NeoSegmentOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

const props = withDefaults(defineProps<{
  modelValue: string;
  options: NeoSegmentOption[];
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

function handleSelect(option: NeoSegmentOption) {
  if (option.disabled || option.value === props.modelValue) return;
  emit("update:modelValue", option.value);
  emit("change", option.value);
}
</script>

<template>
  <view
    class="neo-segmented-control"
    :class="block ? 'neo-segmented-control--block' : ''"
    :style="gridStyle"
  >
    <view
      v-for="option in options"
      :key="option.value"
      class="neo-segmented-control__item"
      :class="[
        option.value === modelValue ? 'neo-segmented-control__item--active' : '',
        option.disabled ? 'neo-segmented-control__item--disabled' : '',
      ]"
      :hover-class="option.disabled ? 'none' : 'neo-segmented-control__item--pressed'"
      @tap="handleSelect(option)"
    >
      <text>{{ option.label }}</text>
    </view>
  </view>
</template>

<style scoped>
.neo-segmented-control {
  display: inline-grid;
  gap: var(--neo-segment-gap);
  padding: var(--neo-segment-padding);
  border: var(--neo-border-default);
  border-radius: var(--neo-segment-radius);
  background: var(--neo-segment-bg);
  box-sizing: border-box;
}

.neo-segmented-control--block {
  display: grid;
  width: 100%;
}

.neo-segmented-control__item {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: var(--neo-segment-height);
  padding: 0 18rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: var(--neo-segment-font-size);
  font-weight: 900;
  line-height: 1.2;
  /* 默认态保留 Neo 硬投影；按压压平、选中切换为 pressed 影。 */
  box-shadow: 3rpx 3rpx 0 var(--neo-color-text);
  box-sizing: border-box;
  transition: transform var(--neo-motion-fast), box-shadow var(--neo-motion-fast), background var(--neo-motion-fast);
}

.neo-segmented-control__item--active {
  background: var(--neo-segment-active-bg);
  box-shadow: var(--neo-shadow-pressed);
}

.neo-segmented-control__item--pressed {
  transform: translate(var(--neo-motion-press-offset), var(--neo-motion-press-offset));
  box-shadow: none;
}

.neo-segmented-control__item--disabled {
  opacity: 0.46;
}
</style>
