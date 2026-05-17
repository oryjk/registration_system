<script setup lang="ts">
import type { ChallengeCardViewModel } from "@/types/viewModels";

defineProps<{
  cards: ChallengeCardViewModel[];
  challengeStageClass: (statusTone: ChallengeCardViewModel["statusTone"]) => string;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "openChallenge", challengeId: string): void;
  (event: "primaryAction", card: ChallengeCardViewModel): void;
}>();

function handleOpenChallenge(challengeId: string) {
  emit("openChallenge", challengeId);
}

function handlePrimaryAction(card: ChallengeCardViewModel) {
  emit("primaryAction", card);
}

function progressWidth(card: ChallengeCardViewModel) {
  return `${Math.min((card.acceptedCount / Math.max(card.capacity, 1)) * 100, 100)}%`;
}

function kindClass(kind: ChallengeCardViewModel["kind"]) {
  return kind === "individual" ? "opportunity-kind opportunity-kind-individual" : "opportunity-kind opportunity-kind-team";
}
</script>

<template>
  <view class="opportunity-list">
    <view
      v-for="card in cards"
      :key="card.id"
      class="opportunity-item"
      @tap="handleOpenChallenge(card.id)"
    >
      <view class="opportunity-date">
        <text class="opportunity-month">{{ card.monthDayLabel }}</text>
        <text class="opportunity-weekday">{{ card.weekdayLabel }}</text>
        <view class="opportunity-time-chip">
          <text class="opportunity-time">{{ card.timeRangeLabel.split(" ")[0] }}</text>
        </view>
      </view>

      <view class="opportunity-body">
        <view class="opportunity-title-row">
          <text class="opportunity-title">{{ card.title }}</text>
          <view class="opportunity-tags">
            <text :class="kindClass(card.kind)">{{ card.kind === "individual" ? "散人报名" : "球队约队" }}</text>
            <text :class="challengeStageClass(card.statusTone)">{{ card.statusLabel }}</text>
          </view>
        </view>
        <text class="opportunity-meta">{{ card.hostTeamName }} · {{ card.formatLabel }}</text>
        <text class="opportunity-meta">{{ card.venue }} · {{ card.priceLabel }}</text>

        <view class="opportunity-progress-row">
          <text class="opportunity-progress-label">报名进度</text>
          <text class="opportunity-progress-value">{{ card.acceptedCount }}/{{ card.capacity }}</text>
        </view>
        <view class="opportunity-progress-track">
          <view class="opportunity-progress-fill" :style="{ width: progressWidth(card) }" />
        </view>

        <view class="opportunity-bottom">
          <text class="opportunity-relation">{{ card.relationLabel }}</text>
          <view
            :class="['opportunity-button', !card.canAccept && !card.currentUserJoined && card.statusTone === 'cancelled' ? 'opportunity-button-disabled' : '']"
            @tap.stop="handlePrimaryAction(card)"
          >
            {{ submitting && (card.canAccept || card.currentUserJoined) ? "处理中..." : card.primaryActionLabel }}
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.opportunity-list {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  margin-top: 22rpx;
}

.opportunity-item {
  display: flex;
  gap: 18rpx;
  padding: 20rpx;
  border-radius: 28rpx;
  background: #fffdf8;
  box-shadow: 0 22rpx 44rpx rgba(43, 55, 38, 0.1);
}

.opportunity-date {
  width: 156rpx;
  flex-shrink: 0;
  min-height: 240rpx;
  padding: 18rpx 16rpx;
  border-radius: 24rpx;
  background: linear-gradient(180deg, #172018 0%, #202a1f 100%);
  color: #fffdf8;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.opportunity-month {
  font-size: 28rpx;
  opacity: 0.92;
  font-weight: 600;
}

.opportunity-weekday {
  margin-top: 8rpx;
  font-size: 46rpx;
  font-weight: 800;
}

.opportunity-time-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: auto;
  padding: 18rpx 8rpx;
  border-radius: 22rpx;
  background: #9be22b;
  color: #172018;
}

.opportunity-time {
  font-size: 30rpx;
  line-height: 1.08;
  font-weight: 800;
}

.opportunity-body {
  flex: 1;
  min-width: 0;
}

.opportunity-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.opportunity-title {
  flex: 1;
  font-size: 32rpx;
  line-height: 1.32;
  color: #172018;
  font-weight: 800;
}

.opportunity-tags {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
}

.opportunity-kind,
.challenge-pill {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  line-height: 1;
  font-weight: 700;
}

.opportunity-kind {
  flex-shrink: 0;
}

.opportunity-kind-individual {
  background: #172018;
  color: #b9f24b;
}

.opportunity-kind-team {
  background: #eff8de;
  color: #3c681b;
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

.opportunity-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #5f685b;
  line-height: 1.45;
  font-weight: 500;
}

.opportunity-progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
  color: #172018;
  font-size: 24rpx;
  font-weight: 700;
}

.opportunity-progress-track {
  position: relative;
  height: 14rpx;
  margin-top: 8rpx;
  border-radius: 999rpx;
  background: #e5eddc;
  overflow: hidden;
}

.opportunity-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #9be22b 0%, #c9f58c 100%);
}

.opportunity-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 18rpx;
}

.opportunity-relation {
  min-width: 0;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #eff3ff;
  color: #5b70d6;
  font-size: 24rpx;
  line-height: 1;
  font-weight: 700;
}

.opportunity-button {
  flex-shrink: 0;
  padding: 16rpx 26rpx;
  border-radius: 999rpx;
  background: #172018;
  color: #fffdf8;
  font-size: 26rpx;
  line-height: 1;
  font-weight: 800;
}

.opportunity-button-disabled {
  background: #dfe7d8;
  color: #7c8677;
}
</style>
