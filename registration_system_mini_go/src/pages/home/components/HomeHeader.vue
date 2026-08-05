<script setup lang="ts">
defineEmits<{
  (event: "select-location"): void;
}>();
</script>

<template>
  <view class="home-header">
    <view class="heading-row">
      <text class="page-title">首页</text>
      <button class="location-button" @click="$emit('select-location')">
        <view class="location-mark" aria-hidden="true" />
        <text>点击定位</text>
        <text class="location-chevron">›</text>
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.home-header {
  padding: calc(var(--status-bar-height, 0px) + 22rpx) 32rpx 22rpx;
  background: var(--canvas);
}

.heading-row {
  display: flex;
  min-height: 96rpx;
  align-items: center;
  gap: 18rpx;
}

.page-title {
  font-size: 48rpx;
  font-weight: 900;
  line-height: 1;
}

.location-button {
  display: flex;
  min-width: 0;
  min-height: 96rpx;
  align-items: center;
  gap: 8rpx;
  padding: 0 8rpx;
  background: transparent;
  color: var(--muted);
  font-size: 26rpx;
  font-weight: 650;
  line-height: 96rpx;
}

.location-mark {
  position: relative;
  width: 22rpx;
  height: 22rpx;
  border: 4rpx solid currentColor;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
}

.location-mark::after {
  position: absolute;
  top: 5rpx;
  left: 5rpx;
  width: 5rpx;
  height: 5rpx;
  border-radius: 50%;
  background: currentColor;
  content: "";
}

.location-chevron {
  font-size: 34rpx;
  line-height: 1;
  transform: rotate(90deg);
}
</style>
