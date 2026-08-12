<script setup lang="ts">
import type { UserMatchCard } from "../userMatchesState";

defineProps<{
  matches: UserMatchCard[];
}>();

defineEmits<{
  openDetail: [matchId: string];
  openMap: [locationLatitude: number | null, locationLongitude: number | null, name: string, address: string];
}>();
</script>

<template>
  <view class="match-list">
    <view
      v-for="match in matches"
      :key="match.id"
      class="match-card"
      @tap="$emit('openDetail', match.id)"
    >
      <view class="match-title-row">
        <text class="match-title">{{ match.title }}</text>
      </view>

      <view class="match-subline">
        <text class="match-kind-badge">{{ match.publicationModeLabel }}</text>
        <text :class="['match-status-badge', `match-status-badge-${match.statusTone}`]">{{ match.statusLabel }}</text>
        <text class="match-footer-text">{{ match.formatLabel }}</text>
        <text class="match-footer-text">{{ match.timeLabel }}</text>
      </view>

      <view class="match-center">
        <view class="team-block">
          <view class="team-kit">
            <view class="team-jersey" :style="{ '--jersey-color': match.color }">
              <view class="team-jersey-body">
                <view class="team-jersey-collar" />
                <view class="team-jersey-stripe" />
              </view>
            </view>
          </view>
          <text class="team-label">主队</text>
        </view>
        <view class="match-vs">VS</view>
        <view class="team-block team-block-right">
          <view class="team-kit">
            <view class="team-jersey team-jersey-mirror" :style="{ '--jersey-color': match.opposingColor }">
              <view class="team-jersey-body">
                <view class="team-jersey-collar" />
                <view class="team-jersey-stripe" />
              </view>
            </view>
          </view>
          <text class="team-label">{{ match.opponent }}</text>
        </view>
      </view>

      <view class="match-footline">
        <text class="match-footline-label">时间 {{ match.dateLabel }}</text>
        <text
          class="match-footline-link"
          @tap.stop="$emit('openMap', match.locationLatitude, match.locationLongitude, match.title, match.venue)"
        >
          {{ match.venue }}
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.match-list {
  margin-top: 16rpx;
}

.match-card {
  margin-top: 14rpx;
  padding: 14rpx 16rpx 12rpx;
  border-radius: 30rpx;
  background: linear-gradient(180deg, #111310 0%, #191b18 100%);
  color: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.match-title-row,
.match-subline,
.match-footline,
.match-center {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.match-kind-badge,
.match-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  font-size: 18rpx;
  font-weight: 900;
}

.match-kind-badge {
  background: rgba(200, 255, 0, 0.16);
  color: #c8ff00;
}

.match-status-badge {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.match-status-badge-success {
  background: rgba(200, 255, 0, 0.16);
  color: #c8ff00;
}

.match-status-badge-warning {
  background: rgba(255, 183, 77, 0.18);
  color: #ffcf7a;
}

.match-status-badge-muted {
  background: rgba(255, 255, 255, 0.1);
  color: #d4d8cf;
}

.match-title-row {
  gap: 12rpx;
}

.match-title {
  min-width: 0;
  flex: 1;
  font-size: 30rpx;
  line-height: 1.15;
  font-weight: 900;
  color: #ffffff;
}

.match-subline {
  margin-top: 8rpx;
  gap: 8rpx;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.match-center {
  margin-top: 10rpx;
  gap: 10rpx;
}

.team-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8rpx;
  min-width: 0;
  flex: 1;
}

.team-block-right {
  align-items: flex-end;
}

.team-kit {
  width: 72rpx;
  height: 60rpx;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.team-jersey {
  position: relative;
  width: 50rpx;
  height: 46rpx;
  border-radius: 12rpx 12rpx 14rpx 14rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(0, 0, 0, 0.1) 100%),
    var(--jersey-color);
  box-shadow:
    inset 0 -8rpx 0 rgba(0, 0, 0, 0.14),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.24),
    0 6rpx 16rpx rgba(0, 0, 0, 0.2);
  overflow: visible;
}

.team-jersey::before,
.team-jersey::after {
  content: "";
  position: absolute;
  top: 4rpx;
  width: 20rpx;
  height: 24rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(0, 0, 0, 0.08) 100%),
    var(--jersey-color);
  border-radius: 12rpx 12rpx 8rpx 8rpx;
  box-shadow: inset 0 -4rpx 0 rgba(0, 0, 0, 0.08);
}

.team-jersey::before {
  left: -10rpx;
  transform: rotate(-14deg);
}

.team-jersey::after {
  right: -10rpx;
  transform: rotate(14deg);
}

.team-jersey-body {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
}

.team-jersey-collar {
  position: absolute;
  left: 50%;
  top: 3rpx;
  width: 22rpx;
  height: 12rpx;
  transform: translateX(-50%);
  border-radius: 0 0 12rpx 12rpx;
  background: rgba(255, 255, 255, 0.2);
}

.team-jersey-stripe {
  position: absolute;
  left: 50%;
  top: 18rpx;
  width: 14rpx;
  height: 18rpx;
  transform: translateX(-50%);
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.18);
}

.team-jersey-mirror {
  transform: scaleX(-1);
}

.team-label {
  min-width: 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 20rpx;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.match-vs {
  flex-shrink: 0;
  width: 66rpx;
  height: 66rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: #c8ff00;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 900;
}

.match-footline {
  margin-top: 10rpx;
  gap: 10rpx;
  flex-wrap: wrap;
  justify-content: space-between;
}

.match-footline-label,
.match-footline-link {
  font-size: 20rpx;
  line-height: 1.2;
  font-weight: 800;
}

.match-footline-label {
  color: rgba(255, 255, 255, 0.7);
}

.match-footline-link {
  color: #c8ff00;
}

.match-footer-text {
  color: rgba(255, 255, 255, 0.72);
  font-size: 20rpx;
  font-weight: 700;
}
</style>
