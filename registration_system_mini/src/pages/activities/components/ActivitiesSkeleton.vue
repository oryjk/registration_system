<template>
  <view class="hall-skeleton-stack">
    <view class="hall-skeleton-row">
      <view class="hall-skeleton-chip" />
      <view class="hall-skeleton-chip" />
      <view class="hall-skeleton-chip hall-skeleton-chip-active" />
      <view class="hall-skeleton-chip" />
    </view>

    <view class="hall-skeleton-row">
      <view class="hall-skeleton-day" />
      <view class="hall-skeleton-day hall-skeleton-day-active" />
      <view class="hall-skeleton-day" />
      <view class="hall-skeleton-day" />
    </view>

    <view class="hall-skeleton-card">
      <view class="hall-skeleton-date" />
      <view class="hall-skeleton-copy">
        <view class="hall-skeleton-line hall-skeleton-line-title" />
        <view class="hall-skeleton-line hall-skeleton-line-body" />
        <view class="hall-skeleton-progress" />
      </view>
    </view>

    <view class="hall-skeleton-card">
      <view class="hall-skeleton-date" />
      <view class="hall-skeleton-copy">
        <view class="hall-skeleton-line hall-skeleton-line-title" />
        <view class="hall-skeleton-line hall-skeleton-line-body" />
        <view class="hall-skeleton-progress" />
      </view>
    </view>
  </view>
</template>

<style scoped>
.hall-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 16rpx;
}

.hall-skeleton-row {
  display: flex;
  gap: 14rpx;
}

.hall-skeleton-chip,
.hall-skeleton-day,
.hall-skeleton-card,
.hall-skeleton-date,
.hall-skeleton-line,
.hall-skeleton-progress {
  position: relative;
  overflow: hidden;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-skeleton-block);
}

.hall-skeleton-chip::after,
.hall-skeleton-day::after,
.hall-skeleton-card::after,
.hall-skeleton-date::after,
.hall-skeleton-line::after,
.hall-skeleton-progress::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.72) 50%, transparent 100%);
  animation: hall-skeleton-shimmer 1.2s ease-in-out infinite;
}

.hall-skeleton-chip {
  width: 132rpx;
  height: 56rpx;
}

.hall-skeleton-chip-active {
  background: var(--neo-color-skeleton-surface);
  box-shadow: 4rpx 4rpx 0 var(--neo-color-accent);
}

.hall-skeleton-day {
  width: 104rpx;
  height: 96rpx;
  border-radius: var(--neo-radius-sm);
}

.hall-skeleton-day-active {
  background: var(--neo-color-skeleton-surface);
  box-shadow: 4rpx 4rpx 0 var(--neo-color-text);
}

.hall-skeleton-card {
  display: flex;
  gap: 18rpx;
  padding: 18rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-skeleton-surface);
  box-shadow: var(--neo-shadow-raised);
}

.hall-skeleton-date {
  width: 150rpx;
  min-height: 210rpx;
  flex-shrink: 0;
  border-radius: var(--neo-radius-xs);
}

.hall-skeleton-copy {
  flex: 1;
}

.hall-skeleton-line {
  height: 24rpx;
  border-radius: 3rpx;
}

.hall-skeleton-line + .hall-skeleton-line {
  margin-top: 14rpx;
}

.hall-skeleton-line-title {
  width: 52%;
  height: 32rpx;
}

.hall-skeleton-line-body {
  width: 78%;
}

.hall-skeleton-progress {
  height: 16rpx;
  margin-top: 26rpx;
  border-radius: var(--neo-radius-xs);
}

@keyframes hall-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
