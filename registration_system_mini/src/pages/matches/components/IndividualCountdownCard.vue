<script setup lang="ts">
defineProps<{
  joinedCount: number;
  requiredPlayers: number;
  countdownText: string;
  progressBaseWidth: string;
  progressExtraWidth: string;
  progressSplitLeft: string;
  participantPreview: Array<{
    id: number;
    name: string;
    avatarUrl: string;
    tone: string;
  }>;
  remainingPlayersLabel: string;
  submittingStatus: boolean;
  individualCtaLabel: string;
  isGuestMode: boolean;
  showCta?: boolean;
}>();

defineEmits<{
  selectIndividualSignup: [];
}>();
</script>

<template>
  <view class="registration-card countdown-card">
    <view class="countdown-head">
      <view class="countdown-head-top">
        <text class="section-title">报名截止</text>
        <view class="countdown-total">
          <text class="countdown-total-label">已报</text>
          <text class="countdown-total-strong">{{ joinedCount }}</text>
          <text class="countdown-total-denominator">/{{ requiredPlayers || "?" }}</text>
        </view>
      </view>
      <text class="countdown-time">{{ countdownText }}</text>
    </view>

    <view class="progress-track">
      <view class="progress-fill" :style="{ width: progressBaseWidth }" />
      <view class="progress-fill-extra" :style="{ left: progressSplitLeft, width: progressExtraWidth }" />
      <view class="progress-split" :style="{ left: progressSplitLeft }" />
    </view>

    <view class="countdown-avatars">
      <view class="avatar-stack">
        <view
          v-for="participant in participantPreview"
          :key="participant.id"
          class="mini-avatar"
          :style="{ background: participant.tone }"
        >
          <image
            v-if="participant.avatarUrl"
            class="mini-avatar-image"
            :src="participant.avatarUrl"
            mode="aspectFill"
          />
          <text v-else class="mini-avatar-text">{{ participant.name.slice(0, 1) }}</text>
        </view>
      </view>
      <text class="countdown-avatars-note">{{ remainingPlayersLabel }}</text>
    </view>

    <view v-if="showCta !== false" class="individual-cta-button" @tap="$emit('selectIndividualSignup')">
      <text class="individual-cta-main">{{ submittingStatus ? "提交中..." : individualCtaLabel }}</text>
      <text v-if="!isGuestMode" class="individual-cta-side">免费</text>
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

.countdown-card {
  padding: 26rpx;
  background: #ffffff;
  box-shadow: 0 16rpx 36rpx rgba(10, 10, 10, 0.05);
}

.countdown-head {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.countdown-head-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  min-width: 0;
}

.section-title {
  display: block;
  color: #171717;
  font-size: 38rpx;
  line-height: 1.25;
  font-weight: 900;
}

.countdown-time {
  display: block;
  color: #131313;
  font-size: 62rpx;
  line-height: 1;
  font-weight: 900;
}

.countdown-total {
  display: inline-flex;
  align-items: flex-end;
  gap: 6rpx;
  color: #6b6b6b;
  font-size: 30rpx;
  line-height: 1;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}

.countdown-total-strong {
  color: #d0ea14;
  font-size: 52rpx;
  font-weight: 900;
  line-height: 0.9;
}

.countdown-total-label,
.countdown-total-denominator {
  color: #6b6b6b;
  font-size: 30rpx;
  line-height: 1;
  font-weight: 700;
}

.progress-track {
  position: relative;
  height: 18rpx;
  margin-top: 24rpx;
  border-radius: 999rpx;
  background: #eceef3;
  overflow: hidden;
}

.progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #d9ff16 0%, #b8ff00 100%);
}

.progress-fill-extra {
  position: absolute;
  top: 0;
  height: 100%;
  background: #ff4d3d;
}

.progress-split {
  position: absolute;
  top: -3rpx;
  width: 4rpx;
  height: 24rpx;
  border-radius: 999rpx;
  background: #ffffff;
  box-shadow: 0 0 0 2rpx rgba(17, 17, 17, 0.06);
  transform: translateX(-50%);
}

.countdown-avatars {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-top: 24rpx;
}

.avatar-stack {
  display: flex;
  align-items: center;
}

.mini-avatar {
  position: relative;
  width: 58rpx;
  height: 58rpx;
  margin-left: -10rpx;
  border: 4rpx solid #ffffff;
  border-radius: 50%;
  overflow: hidden;
  box-sizing: border-box;
}

.mini-avatar:first-child {
  margin-left: 0;
}

.mini-avatar-image {
  width: 100%;
  height: 100%;
}

.mini-avatar-text {
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 800;
}

.countdown-avatars-note {
  color: #303030;
  font-size: 30rpx;
  font-weight: 700;
}

.individual-cta-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  height: 88rpx;
  margin-top: 26rpx;
  border-radius: 999rpx;
  background: linear-gradient(180deg, #2f82ff 0%, #2b68f7 100%);
  box-shadow: 0 14rpx 28rpx rgba(43, 104, 247, 0.22);
}

.individual-cta-main,
.individual-cta-side {
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 900;
}
</style>
