<template>
  <view class="hall-skeleton-stack">
    <view class="hall-skeleton-toolbar" />
    <view class="hall-skeleton-card" />
    <view class="hall-skeleton-card hall-skeleton-card-short" />
  </view>
</template>

<style scoped>
.hall-skeleton-stack,
.hall-skeleton-toolbar,
.hall-skeleton-card {
  position: relative;
  overflow: hidden;
}

.hall-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 28rpx;
}

.hall-skeleton-toolbar {
  height: 92rpx;
  border-radius: 999rpx;
  background: #eef2e8;
}

.hall-skeleton-card {
  height: 260rpx;
  border-radius: 28rpx;
  background: #ffffff;
}

.hall-skeleton-card-short {
  height: 190rpx;
}

.hall-skeleton-toolbar::after,
.hall-skeleton-card::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.78) 50%, transparent 100%);
  animation: hall-skeleton-shimmer 1.2s ease-in-out infinite;
}

@keyframes hall-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
