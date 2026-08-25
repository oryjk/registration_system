<script setup lang="ts">
import { computed } from "vue";

export type NeoButtonVariant = "dark" | "lime" | "outline" | "danger" | "muted";
export type NeoButtonSize = "sm" | "md";

const props = withDefaults(defineProps<{
  variant?: NeoButtonVariant;
  size?: NeoButtonSize;
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
  "neo-button",
  `neo-button--${props.variant}`,
  `neo-button--${props.size}`,
  props.block ? "neo-button--block" : "",
  props.disabled ? "neo-button--disabled" : "",
  props.loading ? "neo-button--loading" : "",
]);

const hoverClass = computed(() => (
  props.disabled || props.loading ? "none" : "neo-button--pressed"
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
        type="primary"
        variant="base"
        :size="props.size === 'sm' ? 'small' : 'medium'"
        :loading="props.loading"
        :disabled="props.disabled"
        :block="props.block"
        :loading-color="props.variant === 'dark' ? 'var(--neo-color-cta-fg)' : 'var(--neo-color-text)'"
        custom-class="neo-button-control"
        :custom-style="controlStyle"
        @click="handleClick"
      >
        <slot />
      </wd-button>
    </view>
</template>

<style scoped>
.neo-button {
  --neo-button-current-bg: var(--neo-button-bg);
  --neo-button-current-fg: var(--neo-button-fg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0 24rpx;
  border: var(--neo-button-border);
  border-radius: var(--neo-button-radius);
  background: var(--neo-button-current-bg);
  color: var(--neo-button-current-fg);
  font-weight: 900;
  box-sizing: border-box;
  transition: transform var(--neo-motion-fast), box-shadow var(--neo-motion-fast);
}

.neo-button--dark {
  --neo-button-current-bg: var(--neo-color-cta);
  --neo-button-current-fg: var(--neo-color-cta-fg);
}

.neo-button--lime {
  --neo-button-current-bg: var(--neo-color-accent);
  --neo-button-current-fg: var(--neo-color-text);
  box-shadow: 3rpx 3rpx 0 var(--neo-color-text);
}

.neo-button--outline {
  --neo-button-current-bg: var(--neo-color-surface);
  --neo-button-current-fg: var(--neo-color-text);
  box-shadow: 3rpx 3rpx 0 var(--neo-color-text);
}

.neo-button--danger {
  --neo-button-current-bg: var(--neo-color-danger);
  --neo-button-current-fg: var(--neo-color-text);
  box-shadow: 3rpx 3rpx 0 var(--neo-color-text);
}

.neo-button--muted {
  --neo-button-current-bg: var(--neo-color-disabled);
  --neo-button-current-fg: var(--neo-color-text-disabled);
}

.neo-button--sm {
  height: var(--neo-button-height-sm);
  padding: 0 16rpx;
  font-size: var(--neo-button-font-size-sm);
}

.neo-button--md {
  /* 显式高度让内层 wd-button 的 height:100% 可解析，否则点击热区会塌缩成文字行高（H5 实测 13px）。 */
  height: var(--neo-button-height-md);
  padding: 0 26rpx;
  font-size: var(--neo-button-font-size-md);
}

.neo-button--block {
  display: flex;
  width: 100%;
}

.neo-button--pressed {
  transform: translate(2rpx, 2rpx);
  box-shadow: none;
}

.neo-button--disabled,
.neo-button--loading {
  pointer-events: none;
}
</style>
