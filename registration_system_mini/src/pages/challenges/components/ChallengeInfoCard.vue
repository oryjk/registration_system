<script setup lang="ts">
import type { BackendChallengeDetail } from "@/types/backend";
import type { ChallengeCardViewModel } from "@/types/viewModels";
import { formatDateTimeLabel } from "@/utils/viewModels";

defineProps<{
  card: ChallengeCardViewModel;
  detail: BackendChallengeDetail;
}>();
</script>

<template>
  <view class="challenge-card">
    <view class="challenge-card-head">
      <view>
        <text class="challenge-card-title">约队主信息</text>
        <text class="challenge-card-caption">先看时间、场地、费用，再决定是否接约。</text>
      </view>
    </view>
    <view class="challenge-grid">
      <view class="challenge-grid-item">
        <text class="challenge-grid-label">比赛时间</text>
        <text class="challenge-grid-value">{{ card.monthDayLabel }} {{ card.weekdayLabel }} {{ card.timeRangeLabel }}</text>
      </view>
      <view class="challenge-grid-item">
        <text class="challenge-grid-label">场地</text>
        <text class="challenge-grid-value">{{ card.venue }}</text>
      </view>
      <view class="challenge-grid-item">
        <text class="challenge-grid-label">比赛规格</text>
        <text class="challenge-grid-value">{{ card.formatLabel }}</text>
      </view>
      <view class="challenge-grid-item">
        <text class="challenge-grid-label">预计费用</text>
        <text class="challenge-grid-value">{{ card.feeLabel }}</text>
      </view>
      <view class="challenge-grid-item">
        <text class="challenge-grid-label">当前关系</text>
        <text class="challenge-grid-value">{{ card.relationLabel }}</text>
      </view>
      <view class="challenge-grid-item">
        <text class="challenge-grid-label">创建时间</text>
        <text class="challenge-grid-value">{{ formatDateTimeLabel(detail.summary.challenge.created_at) }}</text>
      </view>
    </view>
    <view v-if="card.note" class="challenge-note">{{ card.note }}</view>
  </view>
</template>

<style scoped>
.challenge-card {
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 30rpx;
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.challenge-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.challenge-card-title {
  display: block;
  font-size: 30rpx;
  color: #171814;
  font-weight: 900;
}

.challenge-card-caption {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #737870;
}

.challenge-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 22rpx;
}

.challenge-grid-item {
  padding: 22rpx;
  border-radius: 24rpx;
  background: #f6f7f2;
}

.challenge-grid-label {
  display: block;
  font-size: 22rpx;
  color: #767b74;
}

.challenge-grid-value {
  display: block;
  margin-top: 10rpx;
  font-size: 28rpx;
  color: #171814;
  font-weight: 800;
  line-height: 1.5;
}

.challenge-note {
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 22rpx;
  background: #f1f4ea;
  font-size: 24rpx;
  color: #5e635b;
  line-height: 1.6;
}
</style>
