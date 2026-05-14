<template>
  <view class="mine-skeleton-stack">
    <view class="mine-skeleton-profile">
      <view class="mine-skeleton-avatar" />
      <view class="mine-skeleton-copy">
        <view class="mine-skeleton-line mine-skeleton-line-title" />
        <view class="mine-skeleton-line mine-skeleton-line-body" />
        <view class="mine-skeleton-line mine-skeleton-line-short" />
      </view>
    </view>
    <view class="mine-skeleton-stats">
      <view class="mine-skeleton-stat" />
      <view class="mine-skeleton-stat" />
      <view class="mine-skeleton-stat" />
      <view class="mine-skeleton-stat" />
    </view>
  </view>
</template>

<style scoped>
.mine-skeleton-stack,
.mine-skeleton-profile,
.mine-skeleton-line,
.mine-skeleton-avatar,
.mine-skeleton-stat {
  position: relative;
  overflow: hidden;
}

.mine-skeleton-stack {
  padding: 28rpx;
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 24rpx 48rpx rgba(15, 23, 42, 0.08);
}

.mine-skeleton-profile {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.mine-skeleton-avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 36rpx;
  background: #e5eadf;
  flex-shrink: 0;
}

.mine-skeleton-copy {
  flex: 1;
  min-width: 0;
}

.mine-skeleton-line {
  height: 24rpx;
  border-radius: 999rpx;
  background: #e5eadf;
}

.mine-skeleton-line + .mine-skeleton-line {
  margin-top: 16rpx;
}

.mine-skeleton-line-title {
  width: 58%;
  height: 34rpx;
}

.mine-skeleton-line-body {
  width: 76%;
}

.mine-skeleton-line-short {
  width: 46%;
}

.mine-skeleton-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 28rpx;
}

.mine-skeleton-stat {
  height: 112rpx;
  border-radius: 24rpx;
  background: #eef2e8;
}

.mine-skeleton-profile::after,
.mine-skeleton-line::after,
.mine-skeleton-avatar::after,
.mine-skeleton-stat::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.78) 50%, transparent 100%);
  animation: mine-skeleton-shimmer 1.2s ease-in-out infinite;
}

@keyframes mine-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
