<script setup lang="ts">
import { computed } from "vue";
import type { AppTagTone } from "@/types/designSystem";

export type { AppTagTone } from "@/types/designSystem";
export type AppTagSize = "sm" | "md" | "lg";

const props = withDefaults(defineProps<{
  tone?: AppTagTone;
  size?: AppTagSize;
}>(), {
  tone: "muted",
  size: "sm",
});

const toneStyle = computed(() => {
  const tones: Record<AppTagTone, { background: string; color: string }> = {
    lime: {
      background: "var(--ui-color-accent)",
      color: "var(--ui-color-text)",
    },
    green: {
      background: "var(--ui-color-success)",
      color: "var(--ui-color-text)",
    },
    amber: {
      background: "var(--ui-color-warning-soft)",
      color: "var(--ui-color-text)",
    },
    red: {
      background: "var(--ui-color-danger-soft)",
      color: "var(--ui-color-text)",
    },
    blue: {
      background: "var(--ui-color-info-soft)",
      color: "var(--ui-color-text)",
    },
    dark: {
      background: "var(--ui-color-text)",
      color: "var(--ui-color-text-inverse)",
    },
    muted: {
      background: "var(--ui-color-muted)",
      color: "var(--ui-color-text)",
    },
  };

  // #ifdef MP-WEIXIN
  tones.lime = { background: "var(--ui-color-accent-soft)", color: "var(--ui-color-accent-deep)" };
  tones.green = { background: "var(--ui-color-success-bg)", color: "var(--ui-color-success-fg)" };
  tones.amber = { background: "var(--ui-color-warning-bg)", color: "var(--ui-color-warning-fg)" };
  tones.red = { background: "var(--ui-color-danger-bg)", color: "var(--ui-color-danger-fg)" };
  tones.muted = { background: "var(--ui-color-neutral-bg)", color: "var(--ui-color-neutral-fg)" };
  // #endif

  return tones[props.tone];
});

const customStyle = computed(() => [
  "border:var(--ui-tag-border)",
  "border-radius:var(--ui-tag-radius)",
  `background:${toneStyle.value.background}`,
  `color:${toneStyle.value.color}`,
  "font-weight:500",
  "box-sizing:border-box",
  props.size === "sm"
    ? "padding:10rpx 16rpx;font-size:var(--ui-tag-font-size-sm);line-height:1"
    : props.size === "md"
      ? "padding:10rpx 16rpx;font-size:var(--ui-tag-font-size-md);line-height:1"
      : "padding:14rpx 18rpx;font-size:var(--ui-tag-font-size-md);line-height:1",
].join(";"));
</script>

<template>
  <wd-tag
    :size="props.size === 'sm' ? 'small' : props.size === 'md' ? 'medium' : 'large'"
    variant="light"
    :color="toneStyle.color"
    :bg-color="toneStyle.background"
    custom-class="ui-tag-control"
    :custom-style="customStyle"
  >
    <slot />
  </wd-tag>
</template>
