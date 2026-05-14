<script setup lang="ts">
import type { ChallengeCardViewModel } from "@/types/viewModels";
import ChallengeHallCard from "./ChallengeHallCard.vue";

defineProps<{
  teamHallCards: ChallengeCardViewModel[];
  individualHallCards: ChallengeCardViewModel[];
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "openChallengeDetail", card: ChallengeCardViewModel): void;
  (event: "primaryAction", card: ChallengeCardViewModel): void;
}>();

function handleOpenChallengeDetail(card: ChallengeCardViewModel) {
  emit("openChallengeDetail", card);
}

function handlePrimaryAction(card: ChallengeCardViewModel) {
  emit("primaryAction", card);
}
</script>

<template>
  <view class="hall-sections">
    <view class="hall-section">
      <view class="hall-section-head">
        <view>
          <view class="hall-section-title">球队约队</view>
          <view class="hall-section-caption">只有当前球队的队长或领队可以接约。</view>
        </view>
        <text class="hall-section-count">{{ teamHallCards.length }}</text>
      </view>
      <view v-if="teamHallCards.length" class="hall-list">
        <ChallengeHallCard
          v-for="card in teamHallCards"
          :key="card.id"
          :card="card"
          :submitting="submitting"
          variant="team"
          @open="handleOpenChallengeDetail"
          @primary-action="handlePrimaryAction"
        />
      </view>
      <view v-else class="hall-section-empty">当前筛选下还没有球队约队。</view>
    </view>

    <view class="hall-section">
      <view class="hall-section-head">
        <view>
          <view class="hall-section-title">散人约队</view>
          <view class="hall-section-caption">没满员就能报名，但散人约队同一时间只能接一场。</view>
        </view>
        <text class="hall-section-count">{{ individualHallCards.length }}</text>
      </view>
      <view v-if="individualHallCards.length" class="hall-list">
        <ChallengeHallCard
          v-for="card in individualHallCards"
          :key="card.id"
          :card="card"
          :submitting="submitting"
          variant="individual"
          @open="handleOpenChallengeDetail"
          @primary-action="handlePrimaryAction"
        />
      </view>
      <view v-else class="hall-section-empty">当前筛选下还没有散人约队。</view>
    </view>
  </view>
</template>

<style scoped>
.hall-list {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  margin-top: 24rpx;
}

.hall-sections {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-top: 24rpx;
}

.hall-section {
  padding: 28rpx;
  border-radius: 34rpx;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 24rpx 46rpx rgba(17, 17, 17, 0.04);
}

.hall-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.hall-section-title {
  font-size: 34rpx;
  font-weight: 900;
  color: #111111;
}

.hall-section-caption {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #6f756b;
}

.hall-section-count {
  min-width: 64rpx;
  height: 64rpx;
  border-radius: 999rpx;
  background: #eff8d3;
  color: #4c6700;
  font-size: 26rpx;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.hall-section-empty {
  margin-top: 22rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: #f5f6f1;
  color: #676d63;
  font-size: 26rpx;
}
</style>
