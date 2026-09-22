<script setup lang="ts">
import { computed } from "vue";

export type AppSurfaceVariant = "raised" | "outlined" | "dark";

const props = withDefaults(defineProps<{
  variant?: AppSurfaceVariant;
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

// 事件名用 press 而不是 tap：mp-weixin 下 tap 是原生事件名，组件标签上的
// @tap 监听会同时收到原生透传与这里的 emit，导致双触发。
const emit = defineEmits<{
  (event: "press"): void;
}>();

const surfaceClass = computed(() => [
  "ui-surface",
  `ui-surface--${props.variant}`,
  props.interactive ? "ui-surface--interactive" : "",
  props.disabled ? "ui-surface--disabled" : "",
  props.flush ? "ui-surface--flush" : "",
  props.customClass,
]);

const hoverClass = computed(() => (
  props.interactive && !props.disabled ? "ui-surface--pressed" : "none"
));

function handleTap() {
  if (!props.disabled) {
    emit("press");
  }
}
</script>

<template>
  <view :class="surfaceClass" :hover-class="hoverClass" @tap="handleTap">
    <slot />
  </view>
</template>

<style scoped>
.ui-surface {
  padding: var(--ui-surface-padding);
  border: var(--ui-surface-border);
  border-radius: var(--ui-surface-radius);
  background: var(--ui-surface-bg);
  color: var(--ui-surface-fg);
  box-sizing: border-box;
}

.ui-surface--raised {
  box-shadow: var(--ui-surface-shadow);
}

.ui-surface--outlined {
  border-width: 2rpx;
  box-shadow: none;
}

.ui-surface--dark {
  background: var(--ui-color-hero);
  color: var(--ui-color-hero-fg);
  box-shadow: var(--ui-surface-shadow);
}

.ui-surface--interactive {
  transition: transform var(--ui-motion-press-duration) var(--ui-motion-ease-out);
}

.ui-surface--pressed {
  transform: scale(0.98);
}

.ui-surface--disabled {
  opacity: 0.58;
  pointer-events: none;
}

.ui-surface--flush {
  padding: 0;
  overflow: hidden;
}

/* H5 减少动态效果：去掉缩放过渡，按压仅保持视觉禁用/透明度语义。 */
@media (prefers-reduced-motion: reduce) {
  .ui-surface--interactive {
    transition: none;
  }

  .ui-surface--pressed {
    transform: none;
  }
}
</style>
