<script setup lang="ts">
import { computed } from "vue";
import type { NeoTagTone } from "@/types/designSystem";

export type { NeoTagTone } from "@/types/designSystem";
export type NeoTagSize = "sm" | "md" | "lg";

const props = withDefaults(defineProps<{
  tone?: NeoTagTone;
  size?: NeoTagSize;
}>(), {
  tone: "muted",
  size: "sm",
});

const toneStyle = computed(() => {
  const tones: Record<NeoTagTone, { background: string; color: string }> = {
    lime: {
      background: "var(--neo-color-accent)",
      color: "var(--neo-color-text)",
    },
    green: {
      background: "var(--neo-color-success)",
      color: "var(--neo-color-text)",
    },
    amber: {
      background: "var(--neo-color-warning-soft)",
      color: "var(--neo-color-text)",
    },
    red: {
      background: "var(--neo-color-danger-soft)",
      color: "var(--neo-color-text)",
    },
    blue: {
      background: "var(--neo-color-info-soft)",
      color: "var(--neo-color-text)",
    },
    dark: {
      background: "var(--neo-color-text)",
      color: "var(--neo-color-accent)",
    },
    muted: {
      background: "var(--neo-color-muted)",
      color: "var(--neo-color-text)",
    },
  };

  return tones[props.tone];
});

const customStyle = computed(() => [
  "border:var(--neo-tag-border)",
  "border-radius:var(--neo-tag-radius)",
  `background:${toneStyle.value.background}`,
  `color:${toneStyle.value.color}`,
  "font-weight:700",
  "box-sizing:border-box",
  props.size === "sm"
    ? "padding:10rpx 16rpx;font-size:var(--neo-tag-font-size-sm);line-height:1"
    : props.size === "md"
      ? "padding:10rpx 16rpx;font-size:var(--neo-tag-font-size-md);line-height:1"
      : "padding:14rpx 18rpx;font-size:var(--neo-tag-font-size-md);line-height:1",
].join(";"));
</script>

<template>
  <wd-tag
    :size="props.size === 'sm' ? 'small' : props.size === 'md' ? 'medium' : 'large'"
    variant="plain"
    :color="toneStyle.color"
    :bg-color="toneStyle.background"
    custom-class="neo-tag-control"
    :custom-style="customStyle"
  >
    <slot />
  </wd-tag>
</template>
