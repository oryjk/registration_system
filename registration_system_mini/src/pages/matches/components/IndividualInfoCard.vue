<script setup lang="ts">
defineProps<{
  creditScore: number;
}>();
</script>

<template>
  <view class="registration-card info-card">
    <view class="info-card-main">
      <text class="section-title">比赛说明</text>
      <view class="info-list">
        <view class="info-list-item">
          <text class="info-list-dot">◦</text>
          <text class="info-list-text">场地固定，爽约记录低</text>
        </view>
        <view class="info-list-item">
          <text class="info-list-dot">◦</text>
          <text class="info-list-text">迟到 10 分钟视为请假</text>
        </view>
        <view class="info-list-item">
          <text class="info-list-dot">◦</text>
          <text class="info-list-text">如遇雨天，提前 1 小时通知</text>
        </view>
      </view>
    </view>
    <view class="credit-box">
      <text class="credit-box-score">{{ creditScore }} 分</text>
      <text class="credit-box-label">本场比赛信用</text>
    </view>
  </view>
</template>

<style scoped>
.registration-card {
  position: relative;
  overflow: hidden;
  border-radius: 28rpx;
  box-sizing: border-box;
}

.info-card {
  display: flex;
  align-items: stretch;
  gap: 20rpx;
  padding: 26rpx;
  background: #ffffff;
  box-shadow: 0 16rpx 36rpx rgba(10, 10, 10, 0.05);
}

.info-card-main {
  flex: 1;
}

.section-title {
  display: block;
  color: #171717;
  font-size: 38rpx;
  line-height: 1.25;
  font-weight: 900;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 20rpx;
}

.info-list-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.info-list-dot {
  color: #171717;
  font-size: 26rpx;
  font-weight: 900;
}

.info-list-text {
  color: #373737;
  font-size: 28rpx;
  line-height: 1.45;
}

.credit-box {
  flex-shrink: 0;
  width: 172rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10rpx;
  border-radius: 24rpx;
  background: linear-gradient(180deg, #f3ffd0 0%, #eff8b2 100%);
}

.credit-box-score {
  color: #1c1c1c;
  font-size: 42rpx;
  font-weight: 900;
}

.credit-box-label {
  color: #5f6d19;
  font-size: 26rpx;
  font-weight: 700;
  text-align: center;
}
</style>
