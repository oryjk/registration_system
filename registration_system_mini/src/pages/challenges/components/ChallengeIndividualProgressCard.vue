<script setup lang="ts">
import type { ChallengeCardViewModel } from "@/types/viewModels";
import type { IndividualParticipantPreview } from "../detailState";

defineProps<{
  card: ChallengeCardViewModel;
  individualProgressPercent: number;
  individualRemainingCount: number;
  individualParticipantPreview: IndividualParticipantPreview[];
  individualAvatarNote: string;
}>();
</script>

<template>
  <view class="challenge-card">
    <view class="challenge-card-head">
      <view>
        <text class="challenge-card-title">报名进度</text>
        <text class="challenge-card-caption">散人局按个人报名凑满人数，满员后不可继续报名。</text>
      </view>
    </view>

    <view class="individual-progress-shell">
      <view class="individual-progress-head">
        <view>
          <text class="individual-progress-value">{{ card.acceptedCount }}/{{ card.capacity }}</text>
          <text class="individual-progress-label">已报名 / 总名额</text>
        </view>
        <view class="individual-progress-side">
          <text class="individual-progress-remain">还差 {{ individualRemainingCount }} 人</text>
          <text class="individual-progress-format">{{ card.formatLabel }}</text>
        </view>
      </view>
      <view class="individual-progress-track">
        <view class="individual-progress-bar" :style="{ width: `${individualProgressPercent}%` }" />
      </view>
      <view class="individual-avatars-row">
        <view v-if="individualParticipantPreview.length" class="individual-avatar-stack">
          <view
            v-for="participant in individualParticipantPreview"
            :key="participant.id"
            class="individual-avatar"
            :style="{ background: participant.tone }"
          >
            <image
              v-if="participant.avatarUrl"
              class="individual-avatar-image"
              :src="participant.avatarUrl"
              mode="aspectFill"
            />
            <text v-else class="individual-avatar-text">{{ participant.name.slice(0, 1) }}</text>
          </view>
        </view>
        <view v-else class="individual-avatar-empty">待</view>
        <text class="individual-avatars-note">{{ individualAvatarNote }}</text>
      </view>
    </view>
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

.individual-progress-shell {
  margin-top: 22rpx;
  padding: 24rpx;
  border-radius: 26rpx;
  background: #f6f7f2;
}

.individual-progress-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.individual-progress-value {
  display: block;
  font-size: 48rpx;
  line-height: 1;
  color: #171814;
  font-weight: 900;
}

.individual-progress-label {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #737870;
  font-weight: 700;
}

.individual-progress-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
  flex-shrink: 0;
}

.individual-progress-remain {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #eef8d6;
  color: #4f6800;
  font-size: 22rpx;
  font-weight: 900;
}

.individual-progress-format {
  font-size: 22rpx;
  color: #767b74;
  font-weight: 800;
}

.individual-progress-track {
  position: relative;
  height: 18rpx;
  margin-top: 24rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #e4e8de;
}

.individual-progress-bar {
  height: 100%;
  border-radius: inherit;
  background: #c8ff00;
}

.individual-avatars-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 22rpx;
}

.individual-avatar-stack {
  display: flex;
  align-items: center;
}

.individual-avatar,
.individual-avatar-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
  border: 4rpx solid #f6f7f2;
  border-radius: 50%;
  overflow: hidden;
  box-sizing: border-box;
}

.individual-avatar {
  position: relative;
  margin-left: -10rpx;
}

.individual-avatar:first-child {
  margin-left: 0;
}

.individual-avatar-empty {
  background: #e4e8de;
  color: #687064;
  font-size: 24rpx;
  font-weight: 900;
}

.individual-avatar-image {
  width: 100%;
  height: 100%;
}

.individual-avatar-text {
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 900;
}

.individual-avatars-note {
  color: #30342d;
  font-size: 26rpx;
  font-weight: 800;
}
</style>
