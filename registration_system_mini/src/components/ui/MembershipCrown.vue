<script setup lang="ts">
withDefaults(defineProps<{ width?: string; height?: string }>(), { width: "40rpx", height: "22rpx" });
</script>

<template>
  <!-- 金属质感会员皇冠（原生 1.8:1，生成入口 scripts/generate-member-crown.mjs）；aspectFit 防止拉伸变形。 -->
  <image class="membership-crown" src="/static/icons/member-crown-gold.png" mode="aspectFit" :style="{ width, height }" aria-hidden="true" />
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
