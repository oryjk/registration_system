<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AppProgress from "@/components/ui/AppProgress.vue";
import AppTag from "@/components/ui/AppTag.vue";
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
          <AppTag :tone="card.kindTone">{{ card.kindLabel }}</AppTag>
          <AppTag :tone="card.opponentStateTone">{{ card.opponentStateLabel }}</AppTag>
        </view>
      </view>
      <text class="hall-match-meta">{{ card.hostTeamName }} · {{ card.formatLabel }}</text>
      <text class="hall-match-meta">{{ card.venue }} · 对手 {{ card.opponentName }}</text>

      <template v-if="card.showProgress">
        <AppProgress
          v-for="bar in card.progressBars"
          :key="bar.key"
          class="hall-ui-progress"
          :label="bar.label"
          :value="bar.joined"
          :target="bar.required"
          :max="bar.max"
          :value-text="`${bar.joined}/${bar.required}`"
        />
      </template>

      <view class="hall-match-bottom">
        <view v-if="card.hostJoinedLabel || card.guestJoinedLabel" class="hall-match-team-tags">
          <AppTag v-if="card.hostJoinedLabel" tone="dark" size="lg">{{ card.hostJoinedLabel }}</AppTag>
          <AppTag v-if="card.guestJoinedLabel" tone="dark" size="lg">{{ card.guestJoinedLabel }}</AppTag>
        </view>
        <view v-else class="hall-match-bottom-spacer" />
        <AppButton class="hall-ui-match-button" :variant="card.actionKind === 'view' ? 'outline' : 'dark'" :stop-propagation="false">
          {{ card.actionLabel }}
        </AppButton>
      </view>
    </view>
  </view>
</template>

<style scoped>
.hall-match-card {
  display: flex;
  gap: 18rpx;
  padding: 20rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-raised);
  box-sizing: border-box;
  transition: transform var(--ui-motion-press-duration) var(--ui-motion-ease-out);
}

.hall-match-card-pressed {
  transform: scale(0.98);
}

.hall-match-date {
  display: flex;
  width: 150rpx;
  min-height: 210rpx;
  padding: 16rpx 14rpx;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-page);
  color: var(--ui-color-text);
}

.hall-match-month {
  font-size: 28rpx;
  font-weight: 600;
}

.hall-match-weekday {
  margin-top: 8rpx;
  font-size: 44rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.hall-match-time-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: auto;
  padding: 14rpx 6rpx;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-accent);
  color: var(--ui-color-text);
}

.hall-match-time {
  font-size: 36rpx;
  line-height: 1.05;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
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

.hall-match-title {  flex: 1;
  font-size: 32rpx;
  line-height: 1.32;
  color: var(--ui-color-text);
  font-weight: 600;
}

.hall-match-tags {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
}

.hall-match-meta {  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  line-height: 1.5;
  color: var(--ui-color-text-muted);
  font-weight: 400;
}

.hall-ui-progress {
  margin-top: 18rpx;
  --ui-progress-meta-font-size: 26rpx;
  --ui-progress-track-margin-top: 10rpx;
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

.hall-ui-match-button {
  min-width: 142rpx;
}
</style>
