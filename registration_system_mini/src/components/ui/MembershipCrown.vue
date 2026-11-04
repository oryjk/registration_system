<script setup lang="ts">
withDefaults(defineProps<{ width?: string; height?: string }>(), { width: "40rpx", height: "22rpx" });
</script>

<template>
  <!-- 金属质感会员皇冠（原生 1.8:1，生成入口 scripts/generate-member-crown.mjs）；aspectFit 防止拉伸变形。
       静态展示：身份标识不使用常驻循环动画（2026-11-04 用户确认取消摇摆）。 -->
  <image class="membership-crown" src="/static/icons/member-crown-gold.png" mode="aspectFit" :style="{ width, height }" aria-hidden="true" />
</template>

<style scoped>
.membership-crown {
  display: block;
  pointer-events: none;
}
</style>
