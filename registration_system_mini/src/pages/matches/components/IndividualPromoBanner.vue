<template>
  <view class="promo-banner">
    <view class="promo-copy">
      <text class="promo-kicker">闪动杯 FlashX Cup</text>
      <text class="promo-title">全民足球赛 火热报名中</text>
      <view class="promo-button">查看详情</view>
    </view>
    <view class="promo-cup" />
    <view class="promo-ball" />
  </view>
</template>

<style scoped>
.promo-banner {
  position: relative;
  min-height: 190rpx;
  padding: 26rpx;
  overflow: hidden;
  border-radius: 28rpx;
  background: linear-gradient(135deg, #1368ff 0%, #256cff 44%, #0f4ed2 100%);
  box-sizing: border-box;
}

.promo-banner::before {
  content: "";
  position: absolute;
  right: 110rpx;
  top: -40rpx;
  width: 220rpx;
  height: 220rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(217, 255, 22, 0.16) 0%, transparent 72%);
}

.promo-copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  max-width: 52%;
}

.promo-kicker,
.promo-title {
  color: #ffffff;
  font-weight: 900;
}

.promo-kicker {
  font-size: 24rpx;
}

.promo-title {
  font-size: 40rpx;
  line-height: 1.2;
}

.promo-button {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  justify-content: center;
  min-width: 156rpx;
  height: 56rpx;
  margin-top: 6rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  background: #d9ff16;
  color: #171717;
  font-size: 26rpx;
  font-weight: 900;
}

.promo-cup {
  position: absolute;
  right: 86rpx;
  bottom: -8rpx;
  width: 122rpx;
  height: 148rpx;
  border-radius: 24rpx 24rpx 34rpx 34rpx;
  background: linear-gradient(180deg, #ffba4b 0%, #c77807 100%);
  box-shadow:
    inset -10rpx -14rpx 18rpx rgba(0, 0, 0, 0.18),
    0 18rpx 28rpx rgba(0, 0, 0, 0.2);
  transform: rotate(12deg);
}

.promo-cup::before,
.promo-cup::after {
  content: "";
  position: absolute;
  top: 24rpx;
  width: 36rpx;
  height: 64rpx;
  border: 8rpx solid rgba(255, 196, 94, 0.85);
  border-radius: 50%;
}

.promo-cup::before {
  left: -24rpx;
}

.promo-cup::after {
  right: -24rpx;
}

.promo-ball {
  position: absolute;
  right: 26rpx;
  bottom: 22rpx;
  width: 74rpx;
  height: 74rpx;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 38%, rgba(0, 0, 0, 0.96) 0 12%, transparent 13%),
    radial-gradient(circle at 27% 62%, rgba(0, 0, 0, 0.92) 0 9%, transparent 10%),
    radial-gradient(circle at 68% 65%, rgba(0, 0, 0, 0.92) 0 9%, transparent 10%),
    radial-gradient(circle at 50% 85%, rgba(0, 0, 0, 0.9) 0 9%, transparent 10%),
    radial-gradient(circle at 35% 32%, #ffffff 0%, #f6f6f6 44%, #cfcfcf 100%);
  box-shadow: 0 12rpx 18rpx rgba(0, 0, 0, 0.16);
}
</style>
