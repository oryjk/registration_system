<template>
  <view class="mine-skeleton-stack">
    <view class="mine-skeleton-hero">
      <view class="mine-skeleton-avatar" />
      <view class="mine-skeleton-hero__copy">
        <view class="mine-skeleton-block mine-skeleton-block--title" />
        <view class="mine-skeleton-block mine-skeleton-block--body" />
        <view class="mine-skeleton-block mine-skeleton-block--short" />
      </view>
      <view class="mine-skeleton-action" />
    </view>

    <view class="mine-skeleton-context">
      <view class="mine-skeleton-heading">
        <view class="mine-skeleton-heading__marker" />
        <view class="mine-skeleton-block mine-skeleton-block--heading" />
      </view>
      <view class="mine-skeleton-team">
        <view class="mine-skeleton-team__logo" />
        <view class="mine-skeleton-team__copy">
          <view class="mine-skeleton-block mine-skeleton-block--body" />
          <view class="mine-skeleton-block mine-skeleton-block--short" />
        </view>
      </view>
      <view class="mine-skeleton-segments">
        <view class="mine-skeleton-segment" />
        <view class="mine-skeleton-segment" />
        <view class="mine-skeleton-segment" />
      </view>
    </view>

    <view class="mine-skeleton-stats">
      <view v-for="index in 4" :key="index" class="mine-skeleton-stat">
        <view class="mine-skeleton-block mine-skeleton-block--value" />
        <view class="mine-skeleton-block mine-skeleton-block--short" />
      </view>
    </view>
  </view>
</template>

<style scoped>
.mine-skeleton-stack {
  display: grid;
  gap: 22rpx;
}

.mine-skeleton-hero,
.mine-skeleton-context,
.mine-skeleton-stat {
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  box-shadow: var(--neo-shadow-raised);
  box-sizing: border-box;
}

.mine-skeleton-hero {
  display: flex;
  min-height: 264rpx;
  align-items: center;
  gap: 18rpx;
  padding: 24rpx;
  background: var(--neo-color-hero);
  box-shadow: 8rpx 8rpx 0 var(--neo-color-accent);
}

.mine-skeleton-avatar,
.mine-skeleton-action,
.mine-skeleton-block,
.mine-skeleton-heading__marker,
.mine-skeleton-team__logo,
.mine-skeleton-segment {
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-skeleton-block);
  animation: mine-skeleton-pulse 1.1s ease-in-out infinite alternate;
}

.mine-skeleton-avatar {
  width: 112rpx;
  height: 112rpx;
  flex-shrink: 0;
  border: 2rpx solid var(--neo-color-surface);
}

.mine-skeleton-hero__copy,
.mine-skeleton-team__copy {
  min-width: 0;
  flex: 1;
}

.mine-skeleton-block {
  height: 22rpx;
}

.mine-skeleton-block + .mine-skeleton-block {
  margin-top: 14rpx;
}

.mine-skeleton-block--title {
  width: 68%;
  height: 34rpx;
  background: var(--neo-color-surface);
}

.mine-skeleton-block--heading {
  width: 210rpx;
  height: 30rpx;
}

.mine-skeleton-block--body {
  width: 76%;
}

.mine-skeleton-block--short {
  width: 48%;
}

.mine-skeleton-block--value {
  width: 58%;
  height: 38rpx;
}

.mine-skeleton-action {
  width: 120rpx;
  height: 52rpx;
  flex-shrink: 0;
  background: var(--neo-color-accent);
}

.mine-skeleton-context {
  padding: 20rpx;
  background: var(--neo-color-surface);
}

.mine-skeleton-heading {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.mine-skeleton-heading__marker {
  width: 40rpx;
  height: 40rpx;
  background: var(--neo-color-accent);
}

.mine-skeleton-team {
  display: flex;
  min-height: 110rpx;
  align-items: center;
  gap: 16rpx;
  margin-top: 18rpx;
  padding: 16rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-info-soft);
  box-sizing: border-box;
}

.mine-skeleton-team__logo {
  width: 68rpx;
  height: 68rpx;
  flex-shrink: 0;
  background: var(--neo-color-surface);
}

.mine-skeleton-segments {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8rpx;
  margin-top: 18rpx;
  padding: 8rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
}

.mine-skeleton-segment {
  height: 68rpx;
  border: var(--neo-border-default);
  background: var(--neo-color-surface);
}

.mine-skeleton-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.mine-skeleton-stat {
  display: flex;
  min-height: 142rpx;
  padding: 20rpx;
  background: var(--neo-color-muted);
  flex-direction: column;
  justify-content: space-between;
}

@keyframes mine-skeleton-pulse {
  from {
    opacity: 0.55;
  }

  to {
    opacity: 1;
  }
}
</style>
