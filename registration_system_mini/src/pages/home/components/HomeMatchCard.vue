<script setup lang="ts">
import { computed } from "vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoProgress from "@/components/neo/NeoProgress.vue";
import NeoTag from "@/components/neo/NeoTag.vue";
import type { HomeMatchCardViewModel } from "@/types/viewModels";

const props = defineProps<{
  match: HomeMatchCardViewModel;
  isGuestMode: boolean;
  isNavigating: boolean;
}>();

const emit = defineEmits<{
  (event: "matchTap", match: HomeMatchCardViewModel): void;
}>();

const actionLabel = computed(() => props.match.actionLabel || (props.match.canRegister ? "去报名" : "查看比赛"));

function handleTap() {
  if (props.match.canOpenDetail) {
    emit("matchTap", props.match);
  }
}

</script>

<template>
  <view
    :class="[
      'home-match-card',
      isNavigating ? 'home-match-card-tapping' : '',
    ]"
    :hover-class="match.canOpenDetail ? 'home-match-card-pressed' : 'none'"
    @tap="handleTap"
  >
    <view class="home-match-date">
      <text class="home-match-month">{{ match.dateBlock.monthDay }}</text>
      <text class="home-match-weekday">{{ match.dateBlock.weekday }}</text>
      <view class="home-match-time-chip">
        <text class="home-match-time">{{ match.dateBlock.timeLabel }}</text>
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
          <NeoTag :tone="match.stageTone">
            {{ match.stage }}
          </NeoTag>
        </view>
      </view>
      <text class="home-match-meta">{{ match.venue }}</text>
      <text class="home-match-meta">{{ match.formatLabel }} · 对手 {{ match.opponent }}</text>

      <NeoProgress
        v-if="match.showRegistrationProgress"
        class="home-neo-progress"
        label="报名进度"
        :value="match.joinedPlayers"
        :target="match.requiredPlayers"
        :max="match.maxPlayers || match.requiredPlayers"
        :value-text="`${match.joinedPlayers}/${match.requiredPlayers}`"
      />

      <view v-if="match.showParticipantAvatars" class="home-avatars-row">
        <view class="home-avatars">
          <template v-if="match.participantAvatars.length > 0">
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
          </template>
          <view v-else class="home-avatars-empty">
            <view class="home-avatars-empty-badge" />
            <text class="home-avatars-empty-text">暂时没有球星报名</text>
          </view>
        </view>
        <text v-if="match.phase !== 'ended'" class="home-avatar-summary">{{ match.remainingPlayersLabel }}</text>
      </view>

      <view class="home-match-bottom">
        <NeoTag v-if="!isGuestMode && match.myStatus" :tone="match.statusTone" size="lg">
          我的状态：{{ match.myStatus }}
        </NeoTag>
        <NeoTag v-else tone="blue" size="lg">登录后报名</NeoTag>

        <NeoButton
          class="home-neo-match-button"
          :variant="match.canRegister ? 'dark' : 'outline'"
          :stop-propagation="false"
        >
          {{ actionLabel }}
        </NeoButton>
      </view>
    </view>
  </view>
</template>

<style scoped>
.home-match-card {
  display: flex;
  gap: 18rpx;
  padding: 18rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
  transition: transform var(--neo-motion-fast), box-shadow var(--neo-motion-fast);
}

.home-match-card-pressed,
.home-match-card-tapping {
  transform: translate(var(--neo-motion-press-offset), var(--neo-motion-press-offset));
  box-shadow: var(--neo-shadow-pressed);
}

.home-match-date {
  display: flex;
  width: 150rpx;
  min-height: 246rpx;
  padding: 16rpx 14rpx;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-xs);
  background: var(--neo-color-text);
  color: var(--neo-color-text-inverse);
}

.home-match-month {
  font-size: 28rpx;
  font-weight: 800;
}

.home-match-weekday {
  margin-top: 8rpx;
  font-size: 46rpx;
  font-weight: 900;
}

.home-match-time-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: auto;
  padding: 16rpx 6rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
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
  color: var(--neo-color-text);
  font-weight: 900;
}

.home-match-tags {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
}

.home-match-meta {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  line-height: 1.5;
  color: var(--neo-color-text-muted);
  font-weight: 600;
}

.home-neo-progress {
  margin-top: 20rpx;
  --neo-progress-meta-font-size: 26rpx;
  --neo-progress-track-margin-top: 10rpx;
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
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.home-avatar {
  width: 42rpx;
  height: 42rpx;
  margin-left: -10rpx;
  flex-shrink: 0;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-round);
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
  color: var(--neo-color-text-inverse);
  font-size: 18rpx;
  font-weight: 700;
}

.home-avatar-summary {
  font-size: 24rpx;
  color: var(--neo-color-text-muted);
  font-weight: 600;
}

.home-avatars-empty {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}

.home-avatars-empty-badge {
  width: 42rpx;
  height: 42rpx;
  border: 2rpx dashed var(--neo-color-text-muted);
  border-radius: var(--neo-radius-round);
  box-sizing: border-box;
  flex-shrink: 0;
  opacity: 0.6;
}

.home-avatars-empty-text {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.home-match-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-top: 22rpx;
}

.home-neo-match-button {
  min-width: 142rpx;
}
</style>
