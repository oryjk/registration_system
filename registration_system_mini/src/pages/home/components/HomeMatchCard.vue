<script setup lang="ts">
import { computed } from "vue";
import { NeoButton, NeoProgress, NeoTag } from "@/components/neo";
import type { NeoTagTone } from "@/components/neo";
import type { HomeMatchCardViewModel } from "@/types/viewModels";

const props = defineProps<{
  match: HomeMatchCardViewModel;
  variant: "default" | "brutalist";
  isGuestMode: boolean;
  isNavigating: boolean;
  formatMatchDateBlock: (match: HomeMatchCardViewModel) => {
    monthDay: string;
    weekday: string;
    timeLabel: string;
  };
  progressBaseWidth: (joinedPlayers: number, requiredPlayers: number, maxPlayers: number) => string;
  progressExtraWidth: (joinedPlayers: number, requiredPlayers: number, maxPlayers: number) => string;
  progressSplitLeft: (requiredPlayers: number, maxPlayers: number) => string;
  stageClass: (stage: string) => string;
  statusClass: (status: string) => string;
}>();

const emit = defineEmits<{
  (event: "matchTap", match: HomeMatchCardViewModel): void;
}>();

const dateBlock = computed(() => props.formatMatchDateBlock(props.match));
const actionLabel = computed(() => props.match.actionLabel || (props.match.canRegister ? "去报名" : "查看比赛"));

function handleTap() {
  if (props.match.canOpenDetail) {
    emit("matchTap", props.match);
  }
}

function stageTone(stage: string): NeoTagTone {
  const className = props.stageClass(stage);
  if (className.includes("red")) return "red";
  if (className.includes("blue")) return "blue";
  if (className.includes("dark") || className.includes("muted")) return "muted";
  return "lime";
}

function statusTone(status: string): NeoTagTone {
  const className = props.statusClass(status);
  if (className.includes("join")) return "green";
  if (className.includes("late")) return "amber";
  if (className.includes("pending")) return "blue";
  return "muted";
}
</script>

<template>
  <view
    :class="[
      'home-match-card',
      variant === 'brutalist' ? 'home-match-card-brutalist' : '',
      isNavigating ? 'home-match-card-tapping' : '',
    ]"
    :hover-class="match.canOpenDetail ? 'home-match-card-pressed' : 'none'"
    @tap="handleTap"
  >
    <view class="home-match-date">
      <text class="home-match-month">{{ dateBlock.monthDay }}</text>
      <text class="home-match-weekday">{{ dateBlock.weekday }}</text>
      <view class="home-match-time-chip">
        <text class="home-match-time">{{ dateBlock.timeLabel }}</text>
        <text class="home-match-time-note">{{ match.dateNote }}</text>
      </view>
    </view>

    <view class="home-match-body">
      <view class="home-match-title-row">
        <text class="home-match-title">{{ match.title }}</text>
        <view class="home-match-tags">
          <NeoTag tone="muted">
            {{ match.publicationModeLabel }}
          </NeoTag>
          <NeoTag v-if="variant === 'brutalist'" :tone="stageTone(match.stage)">
            {{ match.stage }}
          </NeoTag>
          <text v-else :class="stageClass(match.stage)">{{ match.stage }}</text>
        </view>
      </view>
      <text class="home-match-meta">{{ match.venue }}</text>
      <text class="home-match-meta">{{ match.formatLabel }} · 对手 {{ match.opponent }}</text>

      <NeoProgress
        v-if="variant === 'brutalist' && match.showRegistrationProgress"
        class="home-neo-progress"
        label="报名进度"
        :value="match.joinedPlayers"
        :target="match.requiredPlayers"
        :max="match.maxPlayers || match.requiredPlayers"
        :value-text="`${match.joinedPlayers}/${match.requiredPlayers}`"
      />
      <template v-else-if="match.showRegistrationProgress">
        <view class="home-progress-row">
          <text class="home-progress-label">报名进度</text>
          <text class="home-progress-value">{{ match.joinedPlayers }}/{{ match.requiredPlayers }}</text>
        </view>
        <view class="home-progress-track">
          <view class="home-progress-fill" :style="{ width: progressBaseWidth(match.joinedPlayers, match.requiredPlayers, match.maxPlayers) }" />
          <view
            class="home-progress-fill-extra"
            :style="{
              left: progressSplitLeft(match.requiredPlayers, match.maxPlayers),
              width: progressExtraWidth(match.joinedPlayers, match.requiredPlayers, match.maxPlayers),
            }"
          />
          <view class="home-progress-split" :style="{ left: progressSplitLeft(match.requiredPlayers, match.maxPlayers) }" />
        </view>
      </template>

      <view v-if="match.showParticipantAvatars" class="home-avatars-row">
        <view class="home-avatars">
          <view
            v-for="avatar in match.participantAvatars"
            :key="avatar.userId"
            class="home-avatar"
            :style="{ backgroundColor: avatar.tone }"
          >
            <image
              v-if="avatar.avatarUrl"
              class="home-avatar-image"
              :src="avatar.avatarUrl"
              mode="aspectFill"
            />
            <text v-else class="home-avatar-text">{{ avatar.displayText }}</text>
          </view>
        </view>
        <text class="home-avatar-summary">{{ match.remainingPlayersLabel }}</text>
      </view>

      <view class="home-match-bottom">
        <template v-if="variant === 'brutalist'">
          <NeoTag v-if="!isGuestMode" :tone="statusTone(match.myStatus)" size="lg">
            我的状态：{{ match.myStatus }}
          </NeoTag>
          <NeoTag v-else tone="blue" size="lg">登录后报名</NeoTag>
        </template>
        <template v-else>
          <text v-if="!isGuestMode" :class="statusClass(match.myStatus)">我的状态：{{ match.myStatus }}</text>
          <text v-else class="home-status home-status-pending">登录后报名</text>
        </template>

        <NeoButton
          v-if="variant === 'brutalist'"
          class="home-neo-match-button"
          :variant="match.canRegister ? 'dark' : 'outline'"
          :stop-propagation="false"
        >
          {{ actionLabel }}
        </NeoButton>
        <view
          v-else
          :class="[
            'home-match-button',
            match.canRegister ? '' : 'home-match-button-outline',
          ]"
        >
          {{ actionLabel }}
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.home-match-card {
  display: flex;
  gap: 18rpx;
  padding: 20rpx;
  border-radius: 28rpx;
  background: #fffdf8;
  box-shadow: 0 22rpx 44rpx rgba(43, 55, 38, 0.1);
}

.home-match-card-tapping {
  opacity: 0.76;
}

.home-match-date {
  width: 156rpx;
  flex-shrink: 0;
  min-height: 240rpx;
  padding: 18rpx 16rpx;
  border-radius: 24rpx;
  background: linear-gradient(180deg, #172018 0%, #202a1f 100%);
  color: #fffdf8;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.home-match-month {
  font-size: 28rpx;
  opacity: 0.92;
  font-weight: 600;
}

.home-match-weekday {
  margin-top: 8rpx;
  font-size: 46rpx;
  font-weight: 800;
}

.home-match-time-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: auto;
  padding: 18rpx 8rpx;
  border-radius: 22rpx;
  background: #9be22b;
  color: #172018;
}

.home-match-time {
  font-size: 38rpx;
  line-height: 1.05;
  font-weight: 800;
}

.home-match-time-note {
  margin-top: 6rpx;
  font-size: 20rpx;
  line-height: 1.25;
  font-weight: 700;
}

.home-match-body {
  flex: 1;
  min-width: 0;
}

.home-match-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.home-match-title {
  flex: 1;
  font-size: 32rpx;
  line-height: 1.32;
  color: #172018;
  font-weight: 800;
}

.home-match-tags {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
}

.home-stage {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  line-height: 1;
  font-weight: 700;
}

.home-stage-red {
  background: #fff0ef;
  color: #d85d6a;
}

.home-stage-blue {
  background: #edf0ff;
  color: #5b70d6;
}

.home-stage-dark {
  background: #edf3e4;
  color: #42503f;
}

.home-stage-muted {
  background: #eef2e9;
  color: #767f71;
}

.home-match-meta {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  line-height: 1.5;
  color: #5f685b;
  font-weight: 500;
}

.home-progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20rpx;
}

.home-progress-label,
.home-progress-value {
  font-size: 26rpx;
  font-weight: 700;
  color: #172018;
}

.home-progress-track {
  position: relative;
  width: 100%;
  height: 16rpx;
  margin-top: 10rpx;
  border-radius: 999rpx;
  background: #e3ebdc;
  overflow: hidden;
}

.home-progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #9be22b 0%, #b9f24b 100%);
}

.home-progress-fill-extra {
  position: absolute;
  top: 0;
  height: 100%;
  background: #ed6a5a;
}

.home-progress-split {
  position: absolute;
  top: -3rpx;
  width: 4rpx;
  height: 22rpx;
  border-radius: 999rpx;
  background: #fffdf8;
  box-shadow: 0 0 0 2rpx rgba(43, 55, 38, 0.08);
  transform: translateX(-50%);
}

.home-avatars-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 14rpx;
}

.home-avatars {
  display: flex;
  align-items: center;
}

.home-avatar {
  width: 42rpx;
  height: 42rpx;
  margin-left: -10rpx;
  border-radius: 999rpx;
  border: 4rpx solid #fffdf8;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.home-avatar:first-child {
  margin-left: 0;
}

.home-avatar-image {
  width: 100%;
  height: 100%;
}

.home-avatar-text {
  color: #fffdf8;
  font-size: 18rpx;
  font-weight: 700;
}

.home-avatar-summary {
  font-size: 24rpx;
  color: #5f685b;
  font-weight: 600;
}

.home-match-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-top: 22rpx;
}

.home-status {
  padding: 14rpx 18rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  line-height: 1;
  font-weight: 700;
}

.home-status-join {
  background: #eff8de;
  color: #3c681b;
}

.home-status-leave {
  background: #edf3e4;
  color: #5f685b;
}

.home-status-late {
  background: #fff1df;
  color: #ad6700;
}

.home-status-pending {
  background: #edf0ff;
  color: #5b70d6;
}

.home-match-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 150rpx;
  height: 62rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: #172018;
  color: #fffdf8;
  font-size: 26rpx;
  font-weight: 800;
}

.home-match-button-outline {
  border: 2rpx solid #172018;
  background: #fffdf8;
  color: #172018;
}

.home-match-card-brutalist {
  gap: 18rpx;
  padding: 18rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
  transition: transform var(--neo-motion-fast), box-shadow var(--neo-motion-fast);
}

.home-match-card-brutalist.home-match-card-pressed,
.home-match-card-brutalist.home-match-card-tapping {
  opacity: 1;
  transform: translate(var(--neo-motion-press-offset), var(--neo-motion-press-offset));
  box-shadow: var(--neo-shadow-pressed);
}

.home-match-card-brutalist .home-match-date {
  width: 150rpx;
  min-height: 246rpx;
  padding: 16rpx 14rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-xs);
  background: var(--neo-color-text);
  color: var(--neo-color-text-inverse);
}

.home-match-card-brutalist .home-match-month {
  opacity: 1;
  font-weight: 800;
}

.home-match-card-brutalist .home-match-weekday {
  font-weight: 900;
}

.home-match-card-brutalist .home-match-time-chip {
  padding: 16rpx 6rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
}

.home-match-card-brutalist .home-match-title {
  color: var(--neo-color-text);
  font-weight: 900;
}

.home-match-card-brutalist .home-match-meta,
.home-match-card-brutalist .home-avatar-summary {
  color: var(--neo-color-text-muted);
  font-weight: 600;
}

.home-neo-progress {
  margin-top: 20rpx;
  --neo-progress-meta-font-size: 26rpx;
  --neo-progress-track-margin-top: 10rpx;
}

.home-match-card-brutalist .home-avatar {
  border: var(--neo-border-default);
}

.home-neo-match-button {
  min-width: 142rpx;
}
</style>
