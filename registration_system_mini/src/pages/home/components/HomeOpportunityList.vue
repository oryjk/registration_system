<script setup lang="ts">
import type { ChallengeCardViewModel } from "@/types/viewModels";

defineProps<{
  cards: ChallengeCardViewModel[];
  challengeStageClass: (statusTone: ChallengeCardViewModel["statusTone"]) => string;
}>();
</script>

<template>
  <view class="opportunity-card">
    <view
      v-for="card in cards"
      :key="card.id"
      class="opportunity-item"
    >
      <view class="opportunity-copy">
        <text class="opportunity-title">{{ card.title }}</text>
        <text class="opportunity-meta">{{ card.hostTeamName }} · {{ card.monthDayLabel }} {{ card.weekdayLabel }} {{ card.timeRangeLabel }}</text>
        <text class="opportunity-meta">{{ card.venue }}</text>
      </view>
      <view class="opportunity-side">
        <text class="opportunity-score">{{ card.creditScore }} 分</text>
        <text :class="challengeStageClass(card.statusTone)">{{ card.statusLabel }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.opportunity-card {
  margin-top: 22rpx;
  padding: 18rpx 24rpx;
  border-radius: 34rpx;
  background: #ffffff;
  box-shadow: 0 22rpx 44rpx rgba(17, 17, 17, 0.06);
}

.opportunity-item + .opportunity-item {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 2rpx solid #f0f2eb;
}

.opportunity-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.opportunity-copy {
  min-width: 0;
  flex: 1;
}

.opportunity-title {
  display: block;
  font-size: 34rpx;
  line-height: 1.4;
  color: #111111;
  font-weight: 900;
}

.opportunity-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #61665e;
  line-height: 1.5;
}

.opportunity-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10rpx;
}

.opportunity-score {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #f2f7db;
  color: #4e6800;
  font-size: 24rpx;
  font-weight: 900;
}

.challenge-pill {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 800;
}

.challenge-pill-lime {
  background: #eff8d3;
  color: #4b6700;
}

.challenge-pill-blue {
  background: #ebefff;
  color: #4966d3;
}

.challenge-pill-red {
  background: #ffe9ed;
  color: #ce4760;
}
</style>
