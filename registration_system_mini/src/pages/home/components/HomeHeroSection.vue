<script setup lang="ts">
import type { TeamProfileViewModel } from "@/types/viewModels";

defineProps<{
  currentTeam: TeamProfileViewModel | null;
  teamLogoUrl: string;
  teamInitial: string;
  teamMetaLine: string;
  manageButtonLabel: string;
  isGuestMode: boolean;
}>();

const emit = defineEmits<{
  (event: "manageTap"): void;
  (event: "bannerTap"): void;
}>();

function handleManageTap() {
  emit("manageTap");
}

function handleBannerTap() {
  emit("bannerTap");
}
</script>

<template>
  <view>
    <view v-if="!isGuestMode" class="team-hero-card">
      <view class="team-hero-main">
        <view class="team-hero-logo">
          <image
            v-if="teamLogoUrl"
            class="team-hero-logo-image"
            :src="teamLogoUrl"
            mode="aspectFill"
          />
          <text v-else class="team-hero-logo-text">{{ teamInitial }}</text>
        </view>
        <view class="team-hero-copy">
          <view class="team-hero-title-row">
            <text class="team-hero-name">{{ currentTeam?.name || "我的球队" }}</text>
            <text v-if="currentTeam" class="team-hero-role">{{ currentTeam.myRoleLabel }}</text>
          </view>
          <text class="team-hero-meta">{{ teamMetaLine }}</text>
        </view>
      </view>
      <view class="team-hero-button" @tap="handleManageTap">{{ manageButtonLabel }}</view>
    </view>

    <view class="home-banner" @tap="handleBannerTap">
      <view class="home-banner-copy">
        <text class="home-banner-title">约球开踢</text>
        <text class="home-banner-subtitle">组队 · 报名 · 上场</text>
        <view class="home-banner-button">去看看</view>
      </view>
      <view class="home-banner-goal">GOAL!</view>
      <view class="home-banner-net" />
      <view class="home-banner-ball" />
    </view>
  </view>
</template>

<style scoped>
.team-hero-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22rpx;
  margin-top: 16rpx;
  min-height: 124rpx;
  padding: 18rpx 22rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 20rpx 40rpx rgba(17, 17, 17, 0.06);
}

.team-hero-main {
  display: flex;
  align-items: center;
  gap: 20rpx;
  min-width: 0;
  flex: 1;
}

.team-hero-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  border-radius: 999rpx;
  background: #171717;
  flex-shrink: 0;
  overflow: hidden;
}

.team-hero-logo-image {
  width: 100%;
  height: 100%;
}

.team-hero-logo-text {
  color: #c8ff00;
  font-size: 34rpx;
  font-weight: 900;
}

.team-hero-copy {
  min-width: 0;
}

.team-hero-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.team-hero-name {
  font-size: 30rpx;
  color: #111111;
  font-weight: 900;
}

.team-hero-role {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #111111;
  font-size: 20rpx;
  font-weight: 900;
}

.team-hero-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 21rpx;
  color: #5f645c;
  line-height: 1.45;
}

.team-hero-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 136rpx;
  height: 56rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  border: 2rpx solid #111111;
  color: #111111;
  font-size: 22rpx;
  font-weight: 900;
  background: #ffffff;
  flex-shrink: 0;
}

.home-banner {
  position: relative;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  overflow: hidden;
  margin-top: 18rpx;
  min-height: 194rpx;
  padding: 24rpx 24rpx;
  border-radius: 24rpx;
  background:
    radial-gradient(circle at 30% 40%, rgba(200, 255, 0, 0.15), transparent 35%),
    linear-gradient(135deg, #121212 0%, #1d1d1c 58%, #262624 100%);
}

.home-banner::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1rpx, transparent 1rpx);
  background-size: 12rpx 12rpx;
  opacity: 0.35;
}

.home-banner-copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.home-banner-title {
  font-size: 60rpx;
  line-height: 1;
  color: #ffffff;
  font-weight: 900;
  letter-spacing: -3rpx;
}

.home-banner-subtitle {
  margin-top: 14rpx;
  font-size: 28rpx;
  color: #c8ff00;
  font-weight: 900;
}

.home-banner-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 136rpx;
  height: 54rpx;
  margin-top: 20rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #111111;
  font-size: 24rpx;
  font-weight: 900;
}

.home-banner-goal {
  position: absolute;
  top: 22rpx;
  right: 160rpx;
  z-index: 2;
  color: #c8ff00;
  font-size: 24rpx;
  font-style: italic;
  font-weight: 900;
  transform: rotate(-10deg);
}

.home-banner-net {
  position: absolute;
  right: 12rpx;
  top: 14rpx;
  z-index: 1;
  width: 188rpx;
  height: 150rpx;
  background:
    linear-gradient(120deg, transparent 0 18%, rgba(255,255,255,0.88) 18% 20%, transparent 20% 38%, rgba(255,255,255,0.88) 38% 40%, transparent 40% 58%, rgba(255,255,255,0.88) 58% 60%, transparent 60% 100%),
    linear-gradient(90deg, transparent 0 18%, rgba(255,255,255,0.88) 18% 20%, transparent 20% 38%, rgba(255,255,255,0.88) 38% 40%, transparent 40% 58%, rgba(255,255,255,0.88) 58% 60%, transparent 60% 100%);
  opacity: 0.9;
  clip-path: polygon(18% 0, 100% 0, 100% 100%, 48% 100%);
}

.home-banner-ball {
  position: absolute;
  right: 30rpx;
  bottom: -10rpx;
  z-index: 2;
  width: 154rpx;
  height: 154rpx;
  border-radius: 999rpx;
  background:
    radial-gradient(circle at 35% 35%, #ffffff 0%, #f0f0f0 38%, #1a1a1a 39%, #1a1a1a 48%, #f0f0f0 49%, #ffffff 62%, #d9d9d9 100%);
  box-shadow: inset -16rpx -18rpx 30rpx rgba(0, 0, 0, 0.18);
  transform: rotate(-18deg);
}
</style>
