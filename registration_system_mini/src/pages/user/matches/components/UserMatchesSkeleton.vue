<template>
  <view class="matches-skeleton-stack">
    <view class="matches-skeleton-card" />
    <view class="matches-skeleton-card" />
  </view>
</template>

<style scoped>
.matches-skeleton-stack,
.matches-skeleton-card {
  position: relative;
  overflow: hidden;
}

.matches-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 18rpx;
}

.matches-skeleton-card {
  height: 210rpx;
  border-radius: 30rpx;
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.matches-skeleton-card::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.78) 50%, transparent 100%);
  animation: matches-skeleton-shimmer 1.2s ease-in-out infinite;
}

@keyframes matches-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
