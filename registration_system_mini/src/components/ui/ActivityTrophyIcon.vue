<template>
  <view class="activity-trophy-icon" aria-hidden="true">
    <view class="activity-trophy-cup" />
    <view class="activity-trophy-stem" />
  </view>
</template>

<style scoped>
/* Native outlines inherit the tier's text colour on both H5 and mini-program. */
.activity-trophy-icon { position: relative; width: 28rpx; height: 28rpx; flex-shrink: 0; color: inherit; border-bottom: 2rpx solid currentColor; box-sizing: border-box; }
.activity-trophy-cup { position: absolute; left: 7rpx; top: 0; width: 14rpx; height: 18rpx; border: 2rpx solid currentColor; border-radius: 0 0 8rpx 8rpx; box-sizing: border-box; }
.activity-trophy-icon::before, .activity-trophy-icon::after { content: ''; position: absolute; top: 4rpx; width: 6rpx; height: 10rpx; border: 2rpx solid currentColor; box-sizing: border-box; }
.activity-trophy-icon::before { left: 1rpx; border-right: 0; border-radius: 0 0 0 6rpx; }
.activity-trophy-icon::after { right: 1rpx; border-left: 0; border-radius: 0 0 6rpx 0; }
.activity-trophy-stem { position: absolute; left: 13rpx; top: 18rpx; width: 2rpx; height: 8rpx; background: currentColor; }
</style>
