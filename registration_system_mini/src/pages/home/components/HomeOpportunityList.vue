<script setup lang="ts">
import type { ChallengeCardViewModel } from "@/types/viewModels";

defineProps<{
  cards: ChallengeCardViewModel[];
  challengeStageClass: (statusTone: ChallengeCardViewModel["statusTone"]) => string;
}>();

const emit = defineEmits<{
  (event: "openChallenge", challengeId: string): void;
}>();

function handleOpenChallenge(challengeId: string) {
  emit("openChallenge", challengeId);
}
</script>

<template>
  <view class="opportunity-card">
    <view
      v-for="card in cards"
      :key="card.id"
      class="opportunity-item"
      @tap="handleOpenChallenge(card.id)"
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
  background: #fffdf8;
  box-shadow: 0 22rpx 44rpx rgba(43, 55, 38, 0.1);
}

.opportunity-item + .opportunity-item {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 2rpx solid #dfe7d8;
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
  font-size: 32rpx;
  line-height: 1.34;
  color: #172018;
  font-weight: 800;
}

.opportunity-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #5f685b;
  line-height: 1.5;
  font-weight: 500;
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
  background: #eff8de;
  color: #3c681b;
  font-size: 24rpx;
  line-height: 1;
  font-weight: 700;
}

.challenge-pill {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  line-height: 1;
  font-weight: 700;
}

.challenge-pill-lime {
  background: #eff8de;
  color: #3c681b;
}

.challenge-pill-blue {
  background: #edf0ff;
  color: #5b70d6;
}

.challenge-pill-red {
  background: #fff0ef;
  color: #d85d6a;
}
</style>
