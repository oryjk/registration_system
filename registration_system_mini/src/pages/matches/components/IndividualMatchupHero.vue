<script setup lang="ts">
import type { BackendActivity } from "@/types/backend";

defineProps<{
  match: BackendActivity;
  matchKindLabel: string;
  homeTeamLabel: string;
  displayOpponentLabel: string;
  homeTeamColor: string;
  awayTeamColor: string;
  matchDateLabel: string;
  matchClockLabel: string;
  matchLocation: string;
}>();

defineEmits<{
  openLocation: [];
}>();
</script>

<template>
  <view class="hero-black-card">
    <view class="hero-black-copy">
      <text class="hero-tone-badge">{{ matchKindLabel }}</text>
      <text class="hero-black-title">{{ match.name }}</text>

      <view class="matchup-stage">
        <view class="matchup-side matchup-side-home">
          <text class="matchup-role">主队</text>
          <text class="matchup-name">{{ homeTeamLabel }}</text>
          <view class="matchup-kit">
            <view class="matchup-jersey" :style="{ '--jersey-color': homeTeamColor }">
              <view class="matchup-jersey-body">
                <view class="matchup-jersey-collar" />
                <view class="matchup-jersey-stripe" />
              </view>
            </view>
            <text class="matchup-kit-label">球服</text>
          </view>
        </view>

        <view class="matchup-center">
          <view class="matchup-vs">VS</view>
          <text class="matchup-date">{{ matchDateLabel }}</text>
          <text class="matchup-time">{{ matchClockLabel }}</text>
          <view class="matchup-location" @tap="$emit('openLocation')">
            <text class="matchup-location-text">{{ matchLocation }}</text>
            <text v-if="matchLocation && match.location_latitude != null && match.location_longitude != null" class="matchup-location-arrow">›</text>
          </view>
        </view>

        <view class="matchup-side matchup-side-away">
          <text class="matchup-role">客队</text>
          <text class="matchup-name">{{ displayOpponentLabel }}</text>
          <view class="matchup-kit">
            <text class="matchup-kit-label">球服</text>
            <view class="matchup-jersey matchup-jersey-mirror" :style="{ '--jersey-color': awayTeamColor }">
              <view class="matchup-jersey-body">
                <view class="matchup-jersey-collar" />
                <view class="matchup-jersey-stripe" />
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
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
  background: #9be22b;
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

.matchup-kit {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  width: fit-content;
  padding: 10rpx 12rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
}

.matchup-kit-label {
  color: rgba(255, 255, 255, 0.72);
  font-size: 22rpx;
  line-height: 1;
  font-weight: 800;
}

.matchup-jersey {
  position: relative;
  width: 58rpx;
  height: 52rpx;
  flex-shrink: 0;
  overflow: visible;
}

.matchup-jersey::before,
.matchup-jersey::after {
  content: "";
  position: absolute;
  top: 7rpx;
  z-index: 0;
  width: 23rpx;
  height: 29rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(0, 0, 0, 0.08) 100%),
    var(--jersey-color);
  border-radius: 10rpx 10rpx 8rpx 8rpx;
  box-shadow:
    inset 0 -5rpx 0 rgba(0, 0, 0, 0.16),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.24);
}

.matchup-jersey::before {
  left: 0;
  transform: rotate(-18deg);
}

.matchup-jersey::after {
  right: 0;
  transform: rotate(18deg);
}

.matchup-jersey-body {
  position: absolute;
  left: 50%;
  top: 2rpx;
  z-index: 1;
  width: 39rpx;
  height: 48rpx;
  transform: translateX(-50%);
  border-radius: 12rpx 12rpx 10rpx 10rpx;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.2) 0 18%, transparent 19% 55%, rgba(0, 0, 0, 0.1) 56% 100%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(0, 0, 0, 0.1) 100%),
    var(--jersey-color);
  box-shadow:
    inset 0 -7rpx 0 rgba(0, 0, 0, 0.16),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.28),
    0 6rpx 14rpx rgba(0, 0, 0, 0.22);
  overflow: hidden;
}

.matchup-jersey-collar {
  position: absolute;
  left: 50%;
  top: -1rpx;
  width: 19rpx;
  height: 14rpx;
  transform: translateX(-50%);
  border-radius: 0 0 999rpx 999rpx;
  background: rgba(24, 24, 24, 0.34);
  border: 3rpx solid rgba(255, 255, 255, 0.26);
  border-top: 0;
}

.matchup-jersey-stripe {
  position: absolute;
  left: 50%;
  top: 18rpx;
  width: 4rpx;
  height: 23rpx;
  transform: translateX(-50%);
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.38);
  box-shadow:
    -9rpx 0 0 rgba(255, 255, 255, 0.16),
    9rpx 0 0 rgba(0, 0, 0, 0.1);
}

.matchup-jersey-mirror {
  transform: scaleX(-1);
}

.matchup-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  min-width: 0;
  text-align: center;
}

.matchup-vs {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 74rpx;
  height: 74rpx;
  border-radius: 999rpx;
  background: rgba(217, 255, 22, 0.14);
  border: 1rpx solid rgba(217, 255, 22, 0.42);
  color: #9be22b;
  font-size: 28rpx;
  line-height: 1;
  font-weight: 900;
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
  font-size: 30rpx;
  line-height: 1;
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

.matchup-location-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 22rpx;
  line-height: 1.25;
  text-decoration: underline;
  text-underline-offset: 5rpx;
}

.matchup-location-arrow {
  flex-shrink: 0;
  font-size: 26rpx;
  line-height: 1;
  font-weight: 900;
}
</style>
