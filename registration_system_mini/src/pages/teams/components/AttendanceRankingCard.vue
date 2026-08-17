<script setup lang="ts">
import type { BackendTeamAttendanceRankingItem } from "@/types/backend";
import { rankingInitial, rankingRate } from "../teamStatsState";

defineProps<{
  rankingItems: BackendTeamAttendanceRankingItem[];
  embedded?: boolean;
}>();
</script>

<template>
  <view :class="['stats-card', embedded ? 'stats-card-embedded' : '']">
    <view class="stats-card-head">
      <view>
        <text class="stats-card-title">当前球队出勤排名</text>
        <text class="stats-card-caption">按今年以来当前球队比赛统计</text>
      </view>
    </view>

    <view v-if="rankingItems.length" class="ranking-list">
      <view v-for="(item, index) in rankingItems" :key="item.user_id" class="ranking-item">
        <view class="ranking-order">{{ index + 1 }}</view>
        <image v-if="item.avatar_url" class="ranking-avatar" :src="item.avatar_url" mode="aspectFill" />
        <view v-else class="ranking-avatar ranking-avatar-fallback">{{ rankingInitial(item) }}</view>
        <view class="ranking-copy">
          <view class="ranking-title-row">
            <text class="ranking-name">{{ item.user_name }}</text>
            <text class="ranking-rate">{{ rankingRate(item) }}</text>
          </view>
          <view class="ranking-metrics">
            <text>参加 {{ item.attended_count }}</text>
            <text>请假 {{ item.leave_count }}</text>
            <text>未报名 {{ item.unregistered_count }}</text>
          </view>
        </view>
      </view>
    </view>
    <view v-else class="stats-empty stats-empty-inner">当前球队还没有可展示的排行数据。</view>
  </view>
</template>

<style scoped>
.stats-card {
  margin-top: 16rpx;
  padding: 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
}

.stats-card-embedded {
  margin-top: 0;
  padding: 0;
  border: 0;
  box-shadow: none;
}

.stats-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.stats-card-title {
  display: block;
  font-size: 29rpx;
  line-height: 1.2;
  color: var(--neo-color-text);
  font-weight: 900;
}

.stats-card-caption {
  display: block;
  margin-top: 6rpx;
  font-size: 21rpx;
  color: var(--neo-color-text-muted);
  font-weight: 700;
}

.ranking-list {
  margin-top: 18rpx;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 15rpx 0;
  border-top: 2rpx solid var(--neo-color-track);
}

.ranking-item:first-child {
  border-top: 0;
}

.ranking-order {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42rpx;
  height: 42rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-xs);
  background: var(--neo-color-muted);
  color: var(--neo-color-text);
  font-size: 21rpx;
  font-weight: 900;
  flex-shrink: 0;
  box-sizing: border-box;
}

.ranking-avatar {
  width: 70rpx;
  height: 70rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  flex-shrink: 0;
  background: var(--neo-color-hero);
}

.ranking-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--neo-color-text-inverse);
  font-size: 28rpx;
  font-weight: 900;
}

.ranking-copy {
  min-width: 0;
  flex: 1;
}

.ranking-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.ranking-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--neo-color-text);
  font-size: 27rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-rate {
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 900;
}

.ranking-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 8rpx;
  color: var(--neo-color-text-muted);
  font-size: 21rpx;
  font-weight: 700;
}

.stats-empty {
  margin-top: 18rpx;
  padding: 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  color: var(--neo-color-text-muted);
  font-size: 27rpx;
  font-weight: 700;
  line-height: 1.6;
}

.stats-empty-inner {
  margin-top: 16rpx;
}
</style>
