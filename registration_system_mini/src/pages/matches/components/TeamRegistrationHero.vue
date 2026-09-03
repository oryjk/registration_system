<script setup lang="ts">
import type { BackendActivity, BackendTeam } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";

defineProps<{
  match: BackendActivity;
  dateLine: string;
  heroMetaChips: string[];
  publicationModeLabel: string;
  currentTeam: TeamProfileViewModel | null;
  opponentTeam: BackendTeam | null;
}>();
</script>

<template>
  <view class="hero-black-card team-vs-card">
    <view class="hero-black-copy">
      <text class="hero-tone-badge">球队报名</text>
      <text class="hero-black-title">{{ match.name }}</text>
      <view class="hero-meta-row">
        <text class="hero-meta-icon">◷</text>
        <text class="hero-meta-text">{{ dateLine }}</text>
      </view>
      <view class="hero-meta-row">
        <text class="hero-meta-icon">⌖</text>
        <text class="hero-meta-text">{{ match.location }}</text>
      </view>
      <view class="hero-chip-row">
        <text class="hero-meta-chip hero-meta-chip-type">{{ publicationModeLabel }}</text>
        <text v-for="chip in heroMetaChips" :key="chip" class="hero-meta-chip">{{ chip }}</text>
      </view>
    </view>

    <view class="vs-stage">
      <view class="vs-team-card">
        <view class="vs-logo">
          <image
            v-if="currentTeam?.logoUrl"
            class="vs-logo__image"
            :src="currentTeam.logoUrl"
            mode="aspectFill"
          />
          <text v-else>{{ currentTeam?.name?.slice(0, 1) || "队" }}</text>
        </view>
        <text class="vs-team-name">{{ currentTeam?.name || "当前球队" }}</text>
        <text class="vs-team-credit">{{ currentTeam?.creditScore ?? 0 }} 分</text>
      </view>
      <view v-if="match.host_score != null && match.away_score != null" class="vs-score">
        <text class="vs-score-number">{{ match.host_score }}</text>
        <text class="vs-score-colon">:</text>
        <text class="vs-score-number">{{ match.away_score }}</text>
      </view>
      <text v-else class="vs-mark">VS</text>
      <view class="vs-team-card">
        <view class="vs-logo vs-logo-muted">
          <image
            v-if="opponentTeam?.logo_url"
            class="vs-logo__image vs-logo__image--muted"
            :src="opponentTeam.logo_url"
            mode="aspectFill"
          />
          <text v-else>{{ opponentTeam?.name?.slice(0, 1) || "?" }}</text>
        </view>
        <text class="vs-team-name">{{ opponentTeam?.name || match.opposing || "对手待定" }}</text>
        <text class="vs-team-credit vs-team-credit-muted">{{ opponentTeam?.credit_score ? `${opponentTeam.credit_score} 分` : "--" }}</text>
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

.team-vs-card {
  display: flex;
  flex-direction: column;
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
  background: var(--neo-color-accent);
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

.hero-meta-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  color: rgba(255, 255, 255, 0.82);
}

.hero-meta-icon,
.hero-meta-text {
  font-size: 26rpx;
  line-height: 1.35;
  font-weight: 800;
}

.hero-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 8rpx;
}

.hero-meta-chip {
  display: inline-flex;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.88);
  font-size: 24rpx;
  font-weight: 800;
}

.hero-meta-chip-type {
  background: var(--neo-color-accent);
  color: #181818;
}

.vs-stage {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12rpx;
  margin-top: 30rpx;
}

.vs-team-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  text-align: center;
}

.vs-logo {
  width: 110rpx;
  height: 110rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 6rpx solid var(--neo-color-accent);
  background: #0f0f0f;
  color: #ffffff;
  font-size: 50rpx;
  font-weight: 900;
}

.vs-logo-muted {
  border-color: rgba(255, 255, 255, 0.4);
  background: linear-gradient(180deg, #858585 0%, #5e5e5e 100%);
}

.vs-logo__image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

/* 对手侧 logo 与首字回落保持同级的弱化视觉层级。 */
.vs-logo__image--muted {
  opacity: 0.78;
}

.vs-team-name {
  color: #ffffff;
  font-size: 28rpx;
  line-height: 1.28;
  font-weight: 800;
}

.vs-team-credit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 92rpx;
  height: 42rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: var(--neo-color-accent);
  color: #171717;
  font-size: 24rpx;
  font-weight: 900;
}

.vs-team-credit-muted {
  background: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.86);
}

.vs-mark {
  color: var(--neo-color-accent);
  font-size: 72rpx;
  line-height: 1;
  font-weight: 900;
  font-style: italic;
}

.vs-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}

.vs-score-number {
  font-size: 48rpx;
  line-height: 1.1;
  color: #ffffff;
  font-weight: 900;
}

.vs-score-colon {
  font-size: 34rpx;
  line-height: 1;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 900;
}
</style>
