<script setup lang="ts">
withDefaults(defineProps<{ width?: string; height?: string }>(), { width: "40rpx", height: "22rpx" });
</script>

<template>
  <!-- Lucide crown 的金色 PNG；scaleToFill 与设计稿一致，压低高度并加宽。 -->
  <image class="membership-crown" src="/static/icons/lucide/member-crown.png" mode="scaleToFill" :style="{ width, height }" aria-hidden="true" />
</template>

<style scoped>
.membership-crown {
  display: block;
  pointer-events: none;
  transform-origin: 50% 86%;
  animation: membership-crown-sway var(--ui-avatar-crown-sway-duration, 2400ms) ease-in-out infinite;
}
@keyframes membership-crown-sway {
  0%, 100% { transform: rotate(-12deg); }
  50% { transform: rotate(12deg); }
}
@media (prefers-reduced-motion: reduce) {
  .membership-crown { animation: none; }
}
</style>
