<script setup lang="ts">
import { NeoButton, NeoProgress, NeoTag } from "@/components/neo";
import type { HallMatchCardViewModel } from "../hallMatchState";

const props = defineProps<{
  card: HallMatchCardViewModel;
}>();

const emit = defineEmits<{
  (event: "matchTap", card: HallMatchCardViewModel): void;
}>();

function handleTap() {
  emit("matchTap", props.card);
}
</script>

<script lang="ts">
export default { options: { virtualHost: true } };
</script>

<template>
  <view class="hall-match-card" hover-class="hall-match-card-pressed" @tap="handleTap">
    <view class="hall-match-date">
      <text class="hall-match-month">{{ card.dateBlock.monthDay }}</text>
      <text class="hall-match-weekday">{{ card.dateBlock.weekday }}</text>
      <view class="hall-match-time-chip">
        <text class="hall-match-time">{{ card.dateBlock.timeLabel }}</text>
      </view>
    </view>

    <view class="hall-match-body">
      <view class="hall-match-title-row">
        <text class="hall-match-title">{{ card.title }}</text>
        <view class="hall-match-tags">
          <NeoTag :tone="card.kindTone">{{ card.kindLabel }}</NeoTag>
          <NeoTag :tone="card.opponentStateTone">{{ card.opponentStateLabel }}</NeoTag>
        </view>
      </view>
      <text class="hall-match-meta">{{ card.hostTeamName }} · {{ card.formatLabel }}</text>
      <text class="hall-match-meta">{{ card.venue }} · 对手 {{ card.opponentName }}</text>

      <template v-if="card.showProgress">
        <NeoProgress
          v-for="bar in card.progressBars"
          :key="bar.key"
          class="hall-neo-progress"
          :label="bar.label"
          :value="bar.joined"
          :target="bar.required"
          :max="bar.max"
          :value-text="`${bar.joined}/${bar.required}`"
        />
      </template>

      <view class="hall-match-bottom">
        <view v-if="card.hostJoinedLabel && card.progressBars.length === 1" class="hall-match-team-tags">
          <NeoTag tone="dark" size="lg">{{ card.hostJoinedLabel }}</NeoTag>
        </view>
        <view v-else class="hall-match-bottom-spacer" />
        <NeoButton class="hall-neo-match-button" :variant="card.actionKind === 'view' ? 'outline' : 'dark'" :stop-propagation="false">
          {{ card.actionLabel }}
        </NeoButton>
      </view>
    </view>
  </view>
</template>

<style scoped>
.hall-match-card {
  display: flex;
  gap: 18rpx;
  padding: 18rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
  transition: transform var(--neo-motion-fast), box-shadow var(--neo-motion-fast);
}

.hall-match-card-pressed {
  transform: translate(var(--neo-motion-press-offset), var(--neo-motion-press-offset));
  box-shadow: var(--neo-shadow-pressed);
}

.hall-match-date {
  display: flex;
  width: 150rpx;
  min-height: 210rpx;
  padding: 16rpx 14rpx;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-xs);
  background: var(--neo-color-text);
  color: var(--neo-color-text-inverse);
}

.hall-match-month {
  font-size: 28rpx;
  font-weight: 800;
}

.hall-match-weekday {
  margin-top: 8rpx;
  font-size: 44rpx;
  font-weight: 900;
}

.hall-match-time-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: auto;
  padding: 14rpx 6rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
}

.hall-match-time {
  font-size: 36rpx;
  line-height: 1.05;
  font-weight: 800;
}

.hall-match-body {
  flex: 1;
  min-width: 0;
}

.hall-match-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.hall-match-title {
  flex: 1;
  font-size: 32rpx;
  line-height: 1.32;
  color: var(--neo-color-text);
  font-weight: 900;
}

.hall-match-tags {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
}

.hall-match-meta {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  line-height: 1.5;
  color: var(--neo-color-text-muted);
  font-weight: 600;
}

.hall-neo-progress {
  margin-top: 18rpx;
  --neo-progress-meta-font-size: 26rpx;
  --neo-progress-track-margin-top: 10rpx;
}

.hall-match-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-top: 20rpx;
}

.hall-match-bottom-spacer {
  flex: 1;
}

.hall-match-team-tags {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
}

.hall-neo-match-button {
  min-width: 142rpx;
}
</style>
