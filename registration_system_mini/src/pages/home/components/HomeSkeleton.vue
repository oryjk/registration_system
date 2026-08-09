<template>
  <view class="home-skeleton-stack">
    <view class="home-skeleton-card home-skeleton-card-hero">
      <view class="home-skeleton-row">
        <view class="home-skeleton-avatar" />
        <view class="home-skeleton-copy">
          <view class="home-skeleton-line home-skeleton-line-title" />
          <view class="home-skeleton-line home-skeleton-line-body" />
        </view>
      </view>
      <view class="home-skeleton-pill" />
    </view>

    <view class="home-skeleton-card home-skeleton-card-banner" />

    <view class="home-skeleton-headline">
      <view class="home-skeleton-line home-skeleton-line-section" />
      <view class="home-skeleton-line home-skeleton-line-link" />
    </view>

    <view class="home-skeleton-card home-skeleton-card-match">
      <view class="home-skeleton-line home-skeleton-line-title" />
      <view class="home-skeleton-line home-skeleton-line-body" />
      <view class="home-skeleton-line home-skeleton-line-body" />
      <view class="home-skeleton-progress" />
    </view>

    <view class="home-skeleton-headline">
      <view class="home-skeleton-line home-skeleton-line-section" />
      <view class="home-skeleton-line home-skeleton-line-link" />
    </view>

    <view class="home-skeleton-card home-skeleton-card-opportunity">
      <view class="home-skeleton-line home-skeleton-line-title" />
      <view class="home-skeleton-line home-skeleton-line-body" />
      <view class="home-skeleton-line home-skeleton-line-body short" />
    </view>
  </view>
</template>

<style scoped>
.home-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 16rpx;
}

.home-skeleton-card,
.home-skeleton-headline,
.home-skeleton-line,
.home-skeleton-avatar,
.home-skeleton-pill,
.home-skeleton-progress {
  position: relative;
  overflow: hidden;
}

.home-skeleton-card::after,
.home-skeleton-headline::after,
.home-skeleton-line::after,
.home-skeleton-avatar::after,
.home-skeleton-pill::after,
.home-skeleton-progress::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.72) 50%, transparent 100%);
  animation: home-skeleton-shimmer 1.2s ease-in-out infinite;
}

.home-skeleton-card {
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-skeleton-surface);
}

.home-skeleton-card-hero {
  min-height: 124rpx;
  padding: 18rpx 22rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22rpx;
}

.home-skeleton-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  flex: 1;
}

.home-skeleton-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 999rpx;
  border: var(--neo-border-default);
  background: var(--neo-color-skeleton-block);
  flex-shrink: 0;
}

.home-skeleton-copy {
  flex: 1;
}

.home-skeleton-line {
  height: 24rpx;
  border-radius: 3rpx;
  background: var(--neo-color-skeleton-block);
}

.home-skeleton-line + .home-skeleton-line {
  margin-top: 14rpx;
}

.home-skeleton-line-title {
  width: 44%;
  height: 30rpx;
}

.home-skeleton-line-body {
  width: 78%;
}

.home-skeleton-line-body.short {
  width: 56%;
}

.home-skeleton-line-section {
  width: 220rpx;
  height: 34rpx;
}

.home-skeleton-line-link {
  width: 120rpx;
  height: 28rpx;
}

.home-skeleton-pill {
  width: 136rpx;
  height: 56rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-success);
  flex-shrink: 0;
}

.home-skeleton-card-banner {
  min-height: 194rpx;
}

.home-skeleton-headline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 10rpx;
}

.home-skeleton-card-match {
  min-height: 248rpx;
  padding: 24rpx;
}

.home-skeleton-progress {
  width: 100%;
  height: 16rpx;
  margin-top: 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-xs);
  background: var(--neo-color-skeleton-block);
}

.home-skeleton-card-opportunity {
  min-height: 166rpx;
  padding: 24rpx;
}

@keyframes home-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
