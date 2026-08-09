<template>
  <view class="registration-skeleton-stack">
    <view class="registration-skeleton-segment">
      <view class="registration-skeleton-pill" />
      <view class="registration-skeleton-pill" />
    </view>

    <view class="registration-skeleton-card registration-skeleton-hero">
      <view class="registration-skeleton-copy">
        <view class="registration-skeleton-line registration-skeleton-line-chip" />
        <view class="registration-skeleton-line registration-skeleton-line-title" />
        <view class="registration-skeleton-line registration-skeleton-line-body" />
        <view class="registration-skeleton-line registration-skeleton-line-body short" />
      </view>
      <view class="registration-skeleton-ball" />
    </view>

    <view class="registration-skeleton-card registration-skeleton-countdown">
      <view class="registration-skeleton-row">
        <view class="registration-skeleton-line registration-skeleton-line-section" />
        <view class="registration-skeleton-pill small" />
      </view>
      <view class="registration-skeleton-line registration-skeleton-line-time" />
      <view class="registration-skeleton-progress" />
      <view class="registration-skeleton-avatar-row">
        <view class="registration-skeleton-avatar" />
        <view class="registration-skeleton-avatar" />
        <view class="registration-skeleton-avatar" />
        <view class="registration-skeleton-line registration-skeleton-line-body avatar-note" />
      </view>
    </view>

    <view class="registration-skeleton-card registration-skeleton-info">
      <view class="registration-skeleton-line registration-skeleton-line-section" />
      <view class="registration-skeleton-line registration-skeleton-line-body" />
      <view class="registration-skeleton-line registration-skeleton-line-body short" />
    </view>
  </view>
</template>

<style scoped>
.registration-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.registration-skeleton-card,
.registration-skeleton-segment,
.registration-skeleton-line,
.registration-skeleton-pill,
.registration-skeleton-ball,
.registration-skeleton-progress,
.registration-skeleton-avatar {
  position: relative;
  overflow: hidden;
}

.registration-skeleton-card::after,
.registration-skeleton-segment::after,
.registration-skeleton-line::after,
.registration-skeleton-pill::after,
.registration-skeleton-ball::after,
.registration-skeleton-progress::after,
.registration-skeleton-avatar::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.72) 50%, transparent 100%);
  animation: registration-skeleton-shimmer 1.2s ease-in-out infinite;
}

.registration-skeleton-segment {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  padding: var(--neo-segment-padding);
  border: var(--neo-border-default);
  border-radius: var(--neo-segment-radius);
  background: var(--neo-segment-bg);
}

.registration-skeleton-card {
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-skeleton-surface);
  box-shadow: var(--neo-shadow-raised);
}

.registration-skeleton-hero {
  min-height: 330rpx;
  padding: 30rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #202020;
}

.registration-skeleton-copy {
  width: 58%;
}

.registration-skeleton-countdown,
.registration-skeleton-info {
  padding: 28rpx;
}

.registration-skeleton-countdown {
  min-height: 270rpx;
}

.registration-skeleton-info {
  min-height: 190rpx;
}

.registration-skeleton-row,
.registration-skeleton-avatar-row {
  display: flex;
  align-items: center;
}

.registration-skeleton-row {
  justify-content: space-between;
  gap: 18rpx;
}

.registration-skeleton-avatar-row {
  gap: 10rpx;
  margin-top: 28rpx;
}

.registration-skeleton-line {
  height: 24rpx;
  border-radius: 999rpx;
  background: var(--neo-color-skeleton-block);
}

.registration-skeleton-line + .registration-skeleton-line {
  margin-top: 16rpx;
}

.registration-skeleton-line-chip {
  width: 132rpx;
  height: 42rpx;
  background: var(--neo-color-accent);
}

.registration-skeleton-line-title {
  width: 100%;
  height: 52rpx;
  background: #3a3a3a;
}

.registration-skeleton-line-body {
  width: 78%;
}

.registration-skeleton-hero .registration-skeleton-line-body {
  background: #3a3a3a;
}

.registration-skeleton-line-body.short {
  width: 56%;
}

.registration-skeleton-line-section {
  width: 220rpx;
  height: 34rpx;
}

.registration-skeleton-line-time {
  width: 300rpx;
  height: 54rpx;
  margin-top: 18rpx;
}

.registration-skeleton-line-body.avatar-note {
  width: 220rpx;
  margin-top: 0;
  margin-left: 10rpx;
}

.registration-skeleton-pill {
  height: 74rpx;
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-skeleton-block);
}

.registration-skeleton-pill.small {
  width: 124rpx;
  height: 58rpx;
  flex-shrink: 0;
}

.registration-skeleton-ball {
  width: 156rpx;
  height: 156rpx;
  border-radius: 50%;
  background: var(--neo-color-hero);
  flex-shrink: 0;
}

.registration-skeleton-progress {
  width: 100%;
  height: 18rpx;
  margin-top: 28rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-progress-radius);
  background: var(--neo-color-track);
}

.registration-skeleton-avatar {
  width: 58rpx;
  height: 58rpx;
  border: var(--neo-border-default);
  border-radius: 50%;
  background: var(--neo-color-skeleton-block);
}

@keyframes registration-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
