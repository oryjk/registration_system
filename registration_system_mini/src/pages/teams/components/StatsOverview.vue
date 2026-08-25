<script setup lang="ts">
import type { TeamStatsSummary } from "../teamStatsState";

defineProps<{
  currentYear: number;
  myAvatarUrl: string;
  myInitial: string;
  myDisplayName: string;
  currentTeamName: string;
  mySummary: TeamStatsSummary;
}>();
</script>

<template>
  <view class="stats-overview">
    <view class="stats-profile">
      <image v-if="myAvatarUrl" class="stats-profile-avatar" :src="myAvatarUrl" mode="aspectFill" />
      <view v-else class="stats-profile-avatar stats-profile-avatar-fallback">{{ myInitial }}</view>
      <view class="stats-profile-copy">
        <text class="stats-kicker">{{ currentYear }} 年出勤</text>
        <text class="stats-title">{{ myDisplayName }}</text>
        <text class="stats-subtitle">{{ currentTeamName }}</text>
      </view>
    </view>
    <view class="stats-rate-box">
      <text class="stats-rate-value">{{ mySummary.rate }}</text>
      <text class="stats-rate-label">出勤率</text>
    </view>
  </view>

  <view class="stats-summary-row">
    <view class="stats-summary-item">
      <text class="stats-summary-value">{{ mySummary.attended }}</text>
      <text class="stats-summary-label">参加</text>
    </view>
    <view class="stats-summary-item">
      <text class="stats-summary-value">{{ mySummary.leave }}</text>
      <text class="stats-summary-label">请假</text>
    </view>
    <view class="stats-summary-item">
      <text class="stats-summary-value">{{ mySummary.unregistered }}</text>
      <text class="stats-summary-label">未打卡</text>
    </view>
    <view class="stats-summary-item">
      <text class="stats-summary-value">{{ mySummary.total }}</text>
      <text class="stats-summary-label">总场次</text>
    </view>
  </view>
</template>

<style scoped>
.stats-overview,
.stats-summary-row {
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
}

.stats-overview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 18rpx;
  padding: 22rpx;
}

.stats-profile {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
  flex: 1;
}

.stats-profile-avatar {
  width: 76rpx;
  height: 76rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  flex-shrink: 0;
  background: var(--neo-color-hero);
}

.stats-profile-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--neo-color-hero-fg);
  font-size: 28rpx;
  font-weight: 900;
}

.stats-profile-copy {
  min-width: 0;
  flex: 1;
}

.stats-kicker {
  display: block;
  font-size: 21rpx;
  color: var(--neo-color-text-muted);
  font-weight: 800;
}

.stats-title {
  display: block;
  margin-top: 5rpx;
  font-size: 34rpx;
  line-height: 1.15;
  color: var(--neo-color-text);
  font-weight: 900;
}

.stats-subtitle {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--neo-color-text-muted);
  font-weight: 700;
}

.stats-rate-box {
  min-width: 128rpx;
  padding: 16rpx 14rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-success);
  text-align: center;
}

.stats-rate-value {
  display: block;
  font-size: 40rpx;
  line-height: 1;
  color: var(--neo-color-text);
  font-weight: 900;
}

.stats-rate-label {
  display: block;
  margin-top: 7rpx;
  font-size: 20rpx;
  color: var(--neo-color-text-muted);
  font-weight: 800;
}

.stats-summary-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin-top: 14rpx;
  padding: 18rpx 4rpx;
}

.stats-summary-item {
  text-align: center;
  border-right: 2rpx solid var(--neo-color-track);
}

.stats-summary-item:last-child {
  border-right: 0;
}

.stats-summary-value {
  display: block;
  font-size: 34rpx;
  line-height: 1;
  color: var(--neo-color-text);
  font-weight: 900;
}

.stats-summary-label {
  display: block;
  margin-top: 8rpx;
  font-size: 21rpx;
  color: var(--neo-color-text-muted);
  font-weight: 700;
}
</style>
