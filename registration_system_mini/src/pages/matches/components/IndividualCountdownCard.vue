<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{
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
  ctaDisabled: boolean;
  showCta?: boolean;
}>();

defineEmits<{
  selectIndividualSignup: [];
}>();

const selectedParticipantId = ref<number | null>(null);

const selectedParticipant = computed(() => props.participantPreview.find((participant) => participant.id === selectedParticipantId.value) ?? null);

function handleSelectParticipant(participantId: number) {
  selectedParticipantId.value = selectedParticipantId.value === participantId ? null : participantId;
}
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

    <view class="countdown-progress-meta">
      <text class="countdown-avatars-note">{{ remainingPlayersLabel }}</text>
    </view>

    <view class="progress-track">
      <view class="progress-fill" :style="{ width: progressBaseWidth }" />
      <view class="progress-fill-extra" :style="{ left: progressSplitLeft, width: progressExtraWidth }" />
      <view class="progress-split" :style="{ left: progressSplitLeft }" />
    </view>

    <view class="countdown-avatars">
      <view class="avatar-wall">
        <view
          v-for="participant in participantPreview"
          :key="participant.id"
          :class="['mini-avatar', selectedParticipantId === participant.id ? 'mini-avatar-selected' : '']"
          :style="{ background: participant.tone }"
          @tap="handleSelectParticipant(participant.id)"
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
      <view v-if="selectedParticipant" class="countdown-selected-participant">
        <text class="countdown-selected-name">{{ selectedParticipant.name }}</text>
      </view>
    </view>

    <view
      v-if="showCta !== false"
      :class="['individual-cta-button', ctaDisabled ? 'individual-cta-button-disabled' : '']"
      @tap="ctaDisabled ? undefined : $emit('selectIndividualSignup')"
    >
      <text class="individual-cta-main">{{ submittingStatus ? "提交中..." : individualCtaLabel }}</text>
      <text v-if="!isGuestMode" class="individual-cta-side">免费</text>
    </view>
  </view>
</template>

<style scoped>
.countdown-selected-participant {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  min-height: 58rpx;
  margin-top: 16rpx;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #f3f5ef;
  animation: countdown-selected-chip-enter 180ms ease;
  box-sizing: border-box;
}

.countdown-selected-name {
  color: #171717;
  font-size: 24rpx;
  line-height: 1.2;
  font-weight: 800;
}

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
  color: #9be22b;
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
  margin-top: 20rpx;
  border-radius: 999rpx;
  background: #eceef3;
  overflow: hidden;
}

.countdown-progress-meta {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-top: 22rpx;
}

.progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #9be22b 0%, #b9f24b 100%);
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
  margin-top: 24rpx;
}

.avatar-wall {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  row-gap: 12rpx;
  padding-left: 12rpx;
}

.mini-avatar {
  position: relative;
  width: 72rpx;
  height: 72rpx;
  margin-left: -12rpx;
  border-radius: 50%;
  overflow: hidden;
  box-sizing: border-box;
  transition: transform 180ms ease, box-shadow 180ms ease;
  transform-origin: center center;
}

.mini-avatar:first-child {
  margin-left: 0;
}

.mini-avatar-selected {
  z-index: 2;
  transform: translateY(-4rpx) scale(1.16);
  box-shadow: 0 10rpx 20rpx rgba(17, 17, 17, 0.16);
}

.mini-avatar-image {
  width: 100%;
  height: 100%;
}

.mini-avatar-text {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 800;
}

.countdown-avatars-note {
  color: #303030;
  font-size: 28rpx;
  line-height: 1.25;
  font-weight: 800;
}

@keyframes countdown-selected-chip-enter {
  from {
    opacity: 0;
    transform: translateY(6rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.individual-cta-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  height: 88rpx;
  margin-top: 26rpx;
  border-radius: 999rpx;
  background: #171814;
  box-shadow: 0 18rpx 36rpx rgba(17, 17, 17, 0.22);
}

.individual-cta-button-disabled {
  background: #dfe5d7;
  color: #7d8676;
  box-shadow: none;
}

.individual-cta-main,
.individual-cta-side {
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 900;
}
</style>
