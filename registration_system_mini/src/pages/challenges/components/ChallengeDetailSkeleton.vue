<template>
  <view class="challenge-skeleton-stack">
    <view class="challenge-skeleton-card challenge-skeleton-hero" />
    <view class="challenge-skeleton-card" />
    <view class="challenge-skeleton-card challenge-skeleton-card-short" />
  </view>
</template>

<style scoped>
.challenge-skeleton-stack,
.challenge-skeleton-card {
  position: relative;
  overflow: hidden;
}

.challenge-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.challenge-skeleton-card {
  height: 220rpx;
  border-radius: 28rpx;
  background: #ffffff;
}

.challenge-skeleton-hero {
  height: 260rpx;
  background: #202020;
}

.challenge-skeleton-card-short {
  height: 160rpx;
}

.challenge-skeleton-card::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.76) 50%, transparent 100%);
  animation: challenge-skeleton-shimmer 1.2s ease-in-out infinite;
}

@keyframes challenge-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
