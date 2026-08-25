<script setup lang="ts">
import type { ChallengeCardViewModel } from "@/types/viewModels";

defineProps<{
  card: ChallengeCardViewModel;
}>();
</script>

<template>
  <view class="challenge-hero">
    <view class="challenge-hero-copy">
      <text class="challenge-hero-tag">约队详情</text>
      <text class="challenge-hero-title">{{ card.title }}</text>
      <text class="challenge-hero-meta">{{ card.hostTeamName }} · {{ card.trustLabel }} · 信用 {{ card.creditScore }}</text>
    </view>
    <view class="challenge-hero-side">
      <text :class="['challenge-hero-status', `challenge-hero-status-${card.statusTone}`]">{{ card.statusLabel }}</text>
      <text class="challenge-hero-price">{{ card.priceLabel }}</text>
    </view>
  </view>
</template>

<style scoped>
.challenge-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  padding: 28rpx;
  border-radius: 34rpx;
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.challenge-hero-copy {
  min-width: 0;
}

.challenge-hero-tag {
  display: inline-flex;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: var(--neo-color-accent-soft);
  color: #506900;
  font-size: 22rpx;
  font-weight: 900;
}

.challenge-hero-title {
  display: block;
  margin-top: 14rpx;
  font-size: 42rpx;
  line-height: 1.3;
  color: #131410;
  font-weight: 900;
}

.challenge-hero-meta {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #6d7269;
}

.challenge-hero-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12rpx;
  flex-shrink: 0;
}

.challenge-hero-status {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 800;
}

.challenge-hero-status-open {
  background: var(--neo-color-accent-soft);
  color: var(--neo-color-accent-deep);
}

.challenge-hero-status-matched {
  background: #e9efff;
  color: #4763d2;
}

.challenge-hero-status-cancelled {
  background: #ffe9ec;
  color: #cf455d;
}

.challenge-hero-price {
  font-size: 46rpx;
  color: #131410;
  font-weight: 900;
}
</style>
