<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string;
    fallbackUrl?: string;
    fixed?: boolean;
  }>(),
  {
    label: "返回",
    fallbackUrl: "/pages/home/index",
    fixed: false,
  },
);

function handleBack() {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
    return;
  }

  uni.switchTab({
    url: "/pages/home/index",
  });
}
</script>

<template>
  <view :class="['page-back-button', fixed ? 'page-back-button-fixed' : '']" @tap="handleBack">
    <text class="page-back-icon">‹</text>
    <text class="page-back-label">{{ label }}</text>
  </view>
</template>

<style scoped>
.page-back-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  min-width: 124rpx;
  height: 60rpx;
  padding: 0 20rpx 0 14rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.92);
  color: #111310;
  box-shadow: 0 12rpx 28rpx rgba(17, 17, 17, 0.08);
  border: 2rpx solid rgba(17, 17, 17, 0.06);
  box-sizing: border-box;
}

.page-back-button-fixed {
  position: fixed;
  left: 28rpx;
  top: calc(env(safe-area-inset-top) + 22rpx);
  z-index: 80;
}

.page-back-icon {
  font-size: 38rpx;
  line-height: 1;
  font-weight: 900;
  transform: translateY(-1rpx);
}

.page-back-label {
  font-size: 24rpx;
  font-weight: 900;
}
</style>
