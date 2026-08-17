<template>
  <view class="stats-skeleton-stack">
    <view class="stats-skeleton-card stats-skeleton-hero" />
    <view class="stats-skeleton-card stats-skeleton-list" />
    <view class="stats-skeleton-card stats-skeleton-list" />
  </view>
</template>

<style scoped>
.stats-skeleton-stack,
.stats-skeleton-card {
  position: relative;
  overflow: hidden;
}

.stats-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 18rpx;
}

.stats-skeleton-card {
  height: 132rpx;
  border-radius: 24rpx;
  background: var(--neo-color-track);
}

.stats-skeleton-hero {
  height: 150rpx;
}

.stats-skeleton-list {
  height: 320rpx;
  background: var(--neo-color-surface);
}

.stats-skeleton-card::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, var(--neo-color-surface-translucent) 50%, transparent 100%);
  animation: stats-skeleton-shimmer 1.2s ease-in-out infinite;
}

@keyframes stats-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
