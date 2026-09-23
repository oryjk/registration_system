<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import RegistrationProgressSummary from "@/components/ui/RegistrationProgressSummary.vue";
import type { HallMatchCardViewModel } from "../hallMatchState";

const props = defineProps<{ card: HallMatchCardViewModel }>();
const emit = defineEmits<{
  (event: "matchTap", card: HallMatchCardViewModel): void;
}>();
function handleTap() { emit("matchTap", props.card); }
</script>

<script lang="ts">
export default { options: { virtualHost: true } };
</script>

<template>
  <view class="hall-match-card" @tap="handleTap">
    <view class="hall-match-heading">
      <view class="hall-match-heading-main">
        <text class="hall-match-title">{{ card.title }}</text>
        <view class="hall-match-tags">
          <text class="hall-match-kind">{{ card.kindLabel }}</text>
          <text class="hall-match-status" :class="card.opponentStateTone === 'muted' ? 'hall-match-status--full' : card.opponentStateTone === 'green' ? 'hall-match-status--success' : 'hall-match-status--warning'">{{ card.opponentStateLabel }}</text>
        </view>
      </view>
      <view class="hall-match-date">
        <text class="hall-match-time">{{ card.dateBlock.timeLabel }}</text>
        <text class="hall-match-calendar">{{ card.dateBlock.monthDay }} {{ card.dateBlock.weekday }}</text>
      </view>
    </view>

    <view class="hall-match-info">
      <image class="hall-match-icon" src="/static/icons/lucide/map-pin.png" mode="aspectFit" aria-hidden="true" />
      <text class="hall-match-location">{{ card.venue || '场地待定' }}</text>
      <text class="hall-match-format">{{ card.formatLabel }}</text>
    </view>
    <view v-if="card.hostTeamName" class="hall-match-info hall-match-team-row">
      <image class="hall-match-icon" src="/static/icons/lucide/users.png" mode="aspectFit" aria-hidden="true" />
      <text class="hall-match-teams">{{ card.hostTeamName }}<text v-if="card.opponentName && card.opponentName !== '待定'"> · 对手 {{ card.opponentName }}</text></text>
    </view>

    <view class="hall-match-footer">
      <view class="hall-match-progress-list">
        <template v-if="card.showProgress">
          <view v-for="bar in card.progressBars" :key="bar.key" class="hall-match-progress">
            <RegistrationProgressSummary
              compact
              :title="bar.key === 'host' ? '主队报名' : bar.key === 'guest' ? '客队报名' : bar.label"
              :joined="bar.joined"
              :minimum="bar.required"
              :maximum="bar.max"
            />
          </view>
        </template>
        <text v-else class="hall-match-progress-hint">报名情况见详情</text>
      </view>
      <view class="hall-match-actions">
        <AppButton block size="sm" :variant="card.actionKind === 'view' ? 'outline' : 'dark'" :stop-propagation="false">
          <view class="hall-match-action-content"><text>{{ card.actionLabel }}</text><text class="hall-match-arrow">→</text></view>
        </AppButton>
      </view>
    </view>
    <view v-if="card.capacityHint" class="hall-match-capacity-hint">
      <text>{{ card.capacityHint }}</text>
    </view>
  </view>
</template>

<style scoped>
.hall-match-card {
  padding: 22rpx 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  box-sizing: border-box;
}
.hall-match-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18rpx; }
.hall-match-heading-main { flex: 1; min-width: 0; }
.hall-match-title { display: block; font-size: 30rpx; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
.hall-match-tags { display: flex; align-items: center; flex-wrap: wrap; gap: 6rpx 12rpx; margin-top: 8rpx; }
.hall-match-kind { padding: 3rpx 10rpx; border-radius: var(--ui-radius-md); background: var(--ui-color-accent-soft); color: var(--ui-color-accent-deep); font-size: 20rpx; line-height: 1.5; }
.hall-match-status { font-size: 22rpx; line-height: 1.5; }
.hall-match-status--full { color: var(--ui-color-neutral-fg); background: var(--ui-color-neutral-bg); padding: 3rpx 10rpx; border-radius: var(--ui-radius-md); }
.hall-match-capacity-hint { margin-top: 16rpx; padding: 12rpx 16rpx; border-radius: var(--ui-radius-button); background: var(--ui-color-neutral-bg); color: var(--ui-color-neutral-fg); font-size: 22rpx; line-height: 1.5; }
.hall-match-status--success { color: var(--ui-color-success-fg); }
.hall-match-status--warning { color: var(--ui-color-warning-fg); }
.hall-match-date { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; gap: 4rpx; padding-top: 1rpx; }
.hall-match-time { font-size: 40rpx; line-height: 1.1; font-weight: 600; letter-spacing: -1rpx; font-variant-numeric: tabular-nums; }
.hall-match-calendar { color: var(--ui-color-text-muted); font-size: 22rpx; line-height: 1.5; }
.hall-match-info { display: flex; align-items: flex-start; gap: 10rpx; margin-top: 14rpx; color: var(--ui-color-text-muted); }
.hall-match-icon { width: 26rpx; height: 26rpx; margin-top: 4rpx; flex-shrink: 0; filter: var(--ui-primitive-icon-filter, none); }
.hall-match-location, .hall-match-teams { flex: 1; min-width: 0; font-size: 24rpx; line-height: 1.5; overflow-wrap: anywhere; }
.hall-match-format { flex-shrink: 0; margin-left: 6rpx; font-size: 22rpx; line-height: 1.6; }
.hall-match-team-row { margin-top: 6rpx; }
.hall-match-footer { display: flex; align-items: center; gap: 22rpx; margin-top: 16rpx; padding-top: 16rpx; border-top: var(--ui-border-default); }
.hall-match-progress-list { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12rpx; }
.hall-match-progress { min-width: 0; display: flex; flex-direction: column; align-items: stretch; }
.hall-match-progress-hint { color: var(--ui-color-text-muted); font-size: 22rpx; }
.hall-match-actions { display: flex; flex-direction: column; align-items: stretch; flex-shrink: 0; width: 200rpx; --ui-button-height-sm: 72rpx; --ui-button-font-size-sm: 28rpx; }
.hall-match-action-content { display: flex; align-items: center; justify-content: center; gap: 12rpx; font-size: 28rpx; font-weight: 600; line-height: 1.2; white-space: nowrap; }
.hall-match-arrow { font-size: 32rpx; line-height: 1; }
</style>
