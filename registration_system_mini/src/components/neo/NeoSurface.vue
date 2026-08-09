<script setup lang="ts">
import { computed } from "vue";

export type NeoSurfaceVariant = "raised" | "outlined" | "dark";

const props = withDefaults(defineProps<{
  variant?: NeoSurfaceVariant;
  interactive?: boolean;
  disabled?: boolean;
  flush?: boolean;
  customClass?: string;
}>(), {
  variant: "raised",
  interactive: false,
  disabled: false,
  flush: false,
  customClass: "",
});

const emit = defineEmits<{
  (event: "tap"): void;
}>();

const surfaceClass = computed(() => [
  "neo-surface",
  `neo-surface--${props.variant}`,
  props.interactive ? "neo-surface--interactive" : "",
  props.disabled ? "neo-surface--disabled" : "",
  props.flush ? "neo-surface--flush" : "",
  props.customClass,
]);

const hoverClass = computed(() => (
  props.interactive && !props.disabled ? "neo-surface--pressed" : "none"
));

function handleTap() {
  if (!props.disabled) {
    emit("tap");
  }
}
</script>

<template>
  <view :class="surfaceClass" :hover-class="hoverClass" @tap="handleTap">
    <slot />
  </view>
</template>

<style scoped>
.neo-surface {
  padding: var(--neo-surface-padding);
  border: var(--neo-surface-border);
  border-radius: var(--neo-surface-radius);
  background: var(--neo-surface-bg);
  color: var(--neo-surface-fg);
  box-sizing: border-box;
}

.neo-surface--raised {
  box-shadow: var(--neo-surface-shadow);
}

.neo-surface--outlined {
  border-width: 2rpx;
  box-shadow: none;
}

.neo-surface--dark {
  background: var(--neo-color-text);
  color: var(--neo-color-text-inverse);
  box-shadow: var(--neo-surface-shadow);
}

.neo-surface--interactive {
  transition: transform var(--neo-motion-fast), box-shadow var(--neo-motion-fast);
}

.neo-surface--pressed {
  transform: translate(var(--neo-motion-press-offset), var(--neo-motion-press-offset));
  box-shadow: var(--neo-shadow-pressed);
}

.neo-surface--disabled {
  opacity: 0.58;
  pointer-events: none;
}

.neo-surface--flush {
  padding: 0;
  overflow: hidden;
}
</style>
