<script setup lang="ts">
import { computed } from "vue";

export type AppButtonVariant = "dark" | "lime" | "outline" | "danger" | "muted";
export type AppButtonSize = "sm" | "md";

const props = withDefaults(defineProps<{
  icon?: string;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  stopPropagation?: boolean;
}>(), {
  variant: "dark",
  size: "md",
  loading: false,
  disabled: false,
  block: false,
  stopPropagation: true,
});

const emit = defineEmits<{
  (event: "click"): void;
}>();

const buttonClass = computed(() => [
  "ui-button",
  `ui-button--${props.variant}`,
  `ui-button--${props.size}`,
  props.block ? "ui-button--block" : "",
  props.disabled ? "ui-button--disabled" : "",
  props.loading ? "ui-button--loading" : "",
]);

const hoverClass = computed(() => (
  props.disabled || props.loading ? "none" : "ui-button--pressed"
));

const controlStyle = [
  "width:100%",
  "height:100%",
  "min-width:0",
  "padding:0",
  "border:0",
  "border-radius:0",
  "background:transparent",
  "color:inherit",
  "font-size:inherit",
  "font-weight:inherit",
  "line-height:1",
  "box-shadow:none",
  "--wot-button-primary-bg:transparent",
  "--wot-button-primary-bg-active:transparent",
  "--wot-button-main-color:currentColor",
].join(";");

function handleClick(event: { stopPropagation?: () => void }) {
  if (props.stopPropagation) {
    event.stopPropagation?.();
  }
  if (!props.disabled && !props.loading) {
    emit("click");
  }
}
</script>

<template>
    <view :class="buttonClass" :hover-class="hoverClass">
      <wd-button
        :icon="props.icon"
        type="primary"
        variant="text"
        :size="props.size === 'sm' ? 'small' : 'medium'"
        :loading="props.loading"
        :disabled="props.disabled"
        :block="props.block"
        :loading-color="props.variant === 'dark' ? 'var(--ui-color-cta-fg)' : props.variant === 'danger' ? 'var(--ui-color-hero-fg)' : 'var(--ui-color-text)'"
        custom-class="ui-button-control"
        :custom-style="controlStyle"
        @click="handleClick"
      >
        <slot />
      </wd-button>
    </view>
</template>

<style scoped>
.ui-button {
  --ui-button-current-bg: var(--ui-button-bg);
  --ui-button-current-fg: var(--ui-button-fg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0 30rpx;
  border: 0;
  box-shadow: none;
  border-radius: var(--ui-button-radius);
  background: var(--ui-button-current-bg);
  color: var(--ui-button-current-fg);
  font-weight: var(--ui-button-font-weight);
  box-sizing: border-box;
  transition: transform var(--ui-motion-press-duration) var(--ui-motion-ease-out), opacity var(--ui-motion-press-duration) ease;
}

.ui-button--dark {
  --ui-button-current-bg: var(--ui-color-cta);
  --ui-button-current-fg: var(--ui-color-cta-fg);
}

.ui-button--lime {
  --ui-button-current-bg: var(--ui-color-accent);
  --ui-button-current-fg: var(--ui-color-accent-fg);
}

.ui-button--outline {
  --ui-button-current-bg: var(--ui-color-surface);
  --ui-button-current-fg: var(--ui-color-text);
  border: 2rpx solid var(--ui-color-line-strong);
}

.ui-button--danger {
  --ui-button-current-bg: var(--ui-color-danger);
  --ui-button-current-fg: var(--ui-color-hero-fg);
}

.ui-button--muted {
  --ui-button-current-bg: var(--ui-color-disabled);
  --ui-button-current-fg: var(--ui-color-text-disabled);
}

.ui-button--sm {
  height: var(--ui-button-height-sm);
  padding: 0 20rpx;
  font-size: var(--ui-button-font-size-sm);
}

.ui-button--md {
  /* 显式高度让内层 wd-button 的 height:100% 可解析，否则点击热区会塌缩成文字行高（H5 实测 13px）。 */
  height: var(--ui-button-height-md);
  padding: 0 30rpx;
  font-size: var(--ui-button-font-size-md);
}

.ui-button--block {
  display: flex;
  width: 100%;
}

.ui-button--pressed {
  transform: scale(0.98);
  opacity: 0.92;
}

.ui-button--disabled,
.ui-button--loading {
  pointer-events: none;
}

/* H5 减少动态效果：去掉缩放，只保留短促的不透明度反馈，操作逻辑不受影响。 */
@media (prefers-reduced-motion: reduce) {
  .ui-button {
    transition: opacity 80ms ease;
  }

  .ui-button--pressed {
    transform: none;
  }
}
</style>
