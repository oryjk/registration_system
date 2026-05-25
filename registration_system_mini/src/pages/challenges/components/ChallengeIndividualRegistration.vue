<script setup lang="ts">
import type { ChallengeCardViewModel } from "@/types/viewModels";
import type { IndividualParticipantPreview } from "../detailState";
import IndividualInfoCard from "../../matches/components/IndividualInfoCard.vue";
import IndividualPromoBanner from "../../matches/components/IndividualPromoBanner.vue";

defineProps<{
  card: ChallengeCardViewModel;
  actionLabel: string;
  canAccept: boolean;
  canCancelIndividualAcceptance: boolean;
  actionLoading: boolean;
  countdownText: string;
  progressWidth: string;
  individualRemainingCount: number;
  individualParticipantPreview: IndividualParticipantPreview[];
  individualAvatarNote: string;
  canOpenLocation: boolean;
  paymentStatusLabel: string;
  paymentCountdownText: string;
  canPay: boolean;
}>();

defineEmits<{
  accept: [];
  cancelIndividualAcceptance: [];
  pay: [];
  openLocation: [];
  openActivities: [];
}>();
</script>

<template>
  <view class="challenge-individual-shell">
    <view class="hero-black-card">
      <view class="hero-black-copy">
        <text class="hero-tone-badge">散人约球</text>
        <text class="hero-black-title">{{ card.title }}</text>

        <view class="matchup-stage">
          <view class="matchup-side matchup-side-home">
            <text class="matchup-role">发起方</text>
            <text class="matchup-name">{{ card.hostTeamName }}</text>
          </view>

          <view class="matchup-center">
            <text class="matchup-date">{{ card.monthDayLabel }} {{ card.weekdayLabel }}</text>
            <text class="matchup-time">{{ card.timeRangeLabel }}</text>
            <view :class="['matchup-location', canOpenLocation ? 'matchup-location-active' : '']" @tap="$emit('openLocation')">
              <text class="matchup-location-text">{{ card.venue }}</text>
              <text v-if="canOpenLocation" class="matchup-location-arrow">›</text>
            </view>
          </view>

          <view class="matchup-side matchup-side-away">
            <text class="matchup-role">名额</text>
            <text class="matchup-name">最多 {{ card.maxPlayers }} 人</text>
            <text class="matchup-fee">{{ card.feeLabel }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="registration-card countdown-card">
      <view class="countdown-head">
        <view class="countdown-head-top">
          <text class="section-title">开场倒计时</text>
          <view class="countdown-total">
            <text class="countdown-total-label">已报</text>
            <text class="countdown-total-strong">{{ card.acceptedCount }}</text>
            <text class="countdown-total-denominator">/{{ card.minPlayers || "?" }} 成行</text>
          </view>
        </view>
        <text class="countdown-time">{{ countdownText }}</text>
      </view>

      <view class="progress-track">
        <view class="progress-fill" :style="{ width: progressWidth }" />
      </view>

      <view class="countdown-avatars">
        <view v-if="individualParticipantPreview.length" class="avatar-stack">
          <view
            v-for="participant in individualParticipantPreview"
            :key="participant.id"
            class="mini-avatar"
            :style="{ background: participant.tone }"
          >
            <image v-if="participant.avatarUrl" class="mini-avatar-image" :src="participant.avatarUrl" mode="aspectFill" />
            <text v-else class="mini-avatar-text">{{ participant.name.slice(0, 1) }}</text>
          </view>
        </view>
        <view v-else class="mini-avatar mini-avatar-empty">待</view>
        <text class="countdown-avatars-note">{{ individualAvatarNote }}</text>
      </view>

      <view
        :class="[
          'individual-cta-button',
          canCancelIndividualAcceptance ? 'individual-cta-button-danger' : '',
          !canAccept && !canCancelIndividualAcceptance ? 'individual-cta-button-disabled' : '',
        ]"
        @tap="canCancelIndividualAcceptance ? $emit('cancelIndividualAcceptance') : canAccept ? $emit('accept') : undefined"
      >
        <text class="individual-cta-main">{{ actionLabel }}</text>
        <text v-if="!canCancelIndividualAcceptance && canAccept" class="individual-cta-side">{{ card.priceLabel }}</text>
      </view>

      <view v-if="paymentStatusLabel" class="payment-panel">
        <view class="payment-panel-copy">
          <text class="payment-panel-title">报名支付</text>
          <text class="payment-panel-status">{{ paymentStatusLabel }}</text>
          <text v-if="paymentCountdownText" class="payment-panel-countdown">{{ paymentCountdownText }}</text>
        </view>
        <view
          :class="['payment-panel-button', !canPay || actionLoading ? 'payment-panel-button-disabled' : '']"
          @tap="canPay && !actionLoading ? $emit('pay') : undefined"
        >
          去支付
        </view>
      </view>

      <view class="hall-button" @tap="$emit('openActivities')">回到大厅</view>
    </view>

    <IndividualInfoCard :credit-score="card.creditScore" />
    <IndividualPromoBanner />
  </view>
</template>

<style scoped>
.challenge-individual-shell {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.hero-black-card {
  position: relative;
  min-height: 390rpx;
  padding: 30rpx;
  overflow: hidden;
  border-radius: 28rpx;
  background: linear-gradient(140deg, #222222 0%, #1c1c1c 54%, #2a2a2a 100%);
  box-sizing: border-box;
}

.hero-black-copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  width: 100%;
}

.hero-tone-badge {
  display: inline-flex;
  align-self: flex-start;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #d9ff16;
  color: #181818;
  font-size: 24rpx;
  font-weight: 900;
}

.hero-black-title {
  font-size: 50rpx;
  line-height: 1.15;
  color: #ffffff;
  font-weight: 900;
}

.matchup-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170rpx minmax(0, 1fr);
  align-items: center;
  gap: 16rpx;
  margin-top: 18rpx;
}

.matchup-side {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  min-width: 0;
}

.matchup-side-away {
  align-items: flex-end;
  text-align: right;
}

.matchup-role {
  color: rgba(255, 255, 255, 0.62);
  font-size: 22rpx;
  line-height: 1;
  font-weight: 900;
}

.matchup-name {
  width: 100%;
  color: #ffffff;
  font-size: 34rpx;
  line-height: 1.15;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.matchup-fee {
  max-width: 180rpx;
  color: rgba(255, 255, 255, 0.72);
  font-size: 22rpx;
  line-height: 1.3;
  font-weight: 800;
}

.matchup-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  min-width: 0;
  text-align: center;
}

.matchup-date {
  color: rgba(255, 255, 255, 0.84);
  font-size: 22rpx;
  line-height: 1.2;
  font-weight: 800;
  white-space: nowrap;
}

.matchup-time {
  color: #ffffff;
  font-size: 28rpx;
  line-height: 1.15;
  font-weight: 900;
}

.matchup-location {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  max-width: 172rpx;
  color: rgba(255, 255, 255, 0.82);
}

.matchup-location-active {
  color: rgba(255, 255, 255, 0.92);
}

.matchup-location-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 22rpx;
  line-height: 1.25;
}

.matchup-location-active .matchup-location-text {
  text-decoration: underline;
  text-underline-offset: 5rpx;
}

.matchup-location-arrow {
  flex-shrink: 0;
  font-size: 26rpx;
  line-height: 1;
  font-weight: 900;
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
  font-size: 44rpx;
  line-height: 1.1;
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
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #d9ff16 0%, #b8ff00 100%);
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
  width: 72rpx;
  height: 72rpx;
  margin-left: -12rpx;
  border: 4rpx solid #ffffff;
  border-radius: 50%;
  overflow: hidden;
  box-sizing: border-box;
}

.mini-avatar:first-child {
  margin-left: 0;
}

.mini-avatar-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 0;
  background: #e4e8de;
  color: #687064;
  font-size: 24rpx;
  font-weight: 900;
}

.mini-avatar-image {
  width: 100%;
  height: 100%;
}

.mini-avatar-text {
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 900;
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

.hall-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 84rpx;
  margin-top: 18rpx;
  border-radius: 999rpx;
  background: #ffffff;
  border: 2rpx solid #d9ddd3;
  color: #171814;
  font-size: 30rpx;
  font-weight: 900;
}

.individual-cta-button-danger {
  background: #ffe9ec;
  box-shadow: none;
}

.individual-cta-button-disabled {
  background: #eef0ed;
  box-shadow: none;
}

.individual-cta-main,
.individual-cta-side {
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 900;
}

.individual-cta-button-danger .individual-cta-main {
  color: #cf455d;
}

.individual-cta-button-disabled .individual-cta-main {
  color: #6b7067;
}

.payment-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 24rpx;
  background: #f7f9f2;
  border: 2rpx solid #e3e8d8;
  box-sizing: border-box;
}

.payment-panel-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.payment-panel-title {
  color: #171814;
  font-size: 28rpx;
  font-weight: 900;
}

.payment-panel-status {
  color: #4f584b;
  font-size: 24rpx;
  font-weight: 800;
}

.payment-panel-countdown {
  color: #d45732;
  font-size: 24rpx;
  font-weight: 900;
}

.payment-panel-button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 136rpx;
  height: 64rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: #171814;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.payment-panel-button-disabled {
  background: #d9ddd3;
  color: #737a70;
}

</style>
