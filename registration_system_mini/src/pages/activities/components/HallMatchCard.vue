<script setup lang="ts">
// #ifdef MP-WEIXIN
import AppIcon from "@/components/ui/AppIcon.vue";
// #endif
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
      <!-- #ifdef MP-WEIXIN -->
      <AppIcon name="map-pin" size="var(--ui-icon-sm)" tone="muted" />
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <image class="hall-match-icon" src="/static/icons/lucide/map-pin.png" mode="aspectFit" aria-hidden="true" />
      <!-- #endif -->
      <text class="hall-match-location">{{ card.venue || '场地待定' }}</text>
      <text class="hall-match-format">{{ card.formatLabel }}</text>
    </view>
    <view v-if="card.hostTeamName" class="hall-match-info hall-match-team-row">
      <!-- #ifdef MP-WEIXIN -->
      <AppIcon name="users" size="var(--ui-icon-sm)" tone="muted" />
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <image class="hall-match-icon" src="/static/icons/lucide/users.png" mode="aspectFit" aria-hidden="true" />
      <!-- #endif -->
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
        <!-- #ifdef MP-WEIXIN -->
        <button v-if="card.actionKind === 'view'" class="hall-match-view" hover-class="hall-match-view--pressed">
          <text>{{ card.actionLabel }}</text><AppIcon name="chevron-right" size="var(--ui-icon-xs)" />
        </button>
        <AppButton v-else block size="sm" variant="dark" :stop-propagation="false">
          <text>{{ card.actionLabel }}</text>
        </AppButton>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <AppButton block size="sm" :variant="card.actionKind === 'view' ? 'outline' : 'dark'" :stop-propagation="false">
          <view class="hall-match-action-content"><text>{{ card.actionLabel }}</text><text class="ui-arrow-text hall-match-arrow">→</text></view>
        </AppButton>
        <!-- #endif -->
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

/* #ifdef MP-WEIXIN */
.hall-match-heading { gap: var(--ui-space-4); }
.hall-match-tags { gap: var(--ui-space-2); margin-top: var(--ui-space-2); }
.hall-match-kind { padding: var(--ui-space-1) var(--ui-space-3); border-radius: var(--ui-radius-round); background: var(--ui-color-accent-soft); color: var(--ui-color-text); font-weight: var(--ui-font-weight-heading); }
.hall-match-status { padding: var(--ui-space-1) var(--ui-space-3); border-radius: var(--ui-radius-round); font-size: var(--ui-text-xs); font-weight: var(--ui-font-weight-heading); }
.hall-match-status--success { background: var(--ui-color-success-bg); color: var(--ui-color-success-fg); }
.hall-match-status--warning { background: var(--ui-color-warning-bg); color: var(--ui-color-warning-fg); }
.hall-match-status--full { border-radius: var(--ui-radius-round); padding: var(--ui-space-1) var(--ui-space-3); font-size: var(--ui-text-xs); font-weight: var(--ui-font-weight-heading); }
.hall-match-date { padding: var(--ui-space-2) var(--ui-space-3); border-radius: var(--ui-control-radius); background: var(--ui-panel-soft-bg); align-items: center; }
.hall-match-action-content { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); gap: var(--ui-space-3); }
.hall-match-arrow { font-size: var(--ui-text-title); }
.hall-match-card { padding: var(--ui-space-7); border: var(--ui-panel-border); border-radius: var(--ui-card-radius); background: var(--ui-card-bg); box-shadow: var(--ui-card-shadow); }
.hall-match-title { font-size: var(--ui-text-title); font-weight: var(--ui-font-weight-heading); line-height: var(--ui-line-height-tight); }
.hall-match-time { font-size: var(--ui-text-heading); font-weight: var(--ui-font-weight-heading); letter-spacing: 0; color: var(--ui-color-text); }
.hall-match-info { gap: var(--ui-space-3); margin-top: var(--ui-space-4); }
.hall-match-team-row { margin-top: var(--ui-space-2); }
.hall-match-location, .hall-match-teams { font-size: var(--ui-text-body); line-height: var(--ui-line-height-compact); }
.hall-match-format { padding: 2rpx var(--ui-space-2); border-radius: var(--ui-radius-round); background: var(--ui-panel-soft-bg); color: var(--ui-color-text); font-weight: var(--ui-font-weight-medium); }
.hall-match-footer { border-top: var(--ui-list-divider); margin-top: var(--ui-space-5); padding-top: var(--ui-space-5); gap: var(--ui-space-5); }
.hall-match-capacity-hint { padding: var(--ui-space-2) var(--ui-space-3); background: var(--ui-panel-soft-bg); margin-top: var(--ui-space-4); border-radius: var(--ui-control-radius); color: var(--ui-color-neutral-fg); }
.hall-match-actions { width: calc(var(--ui-space-10) * 4); }
.hall-match-view { display: flex; align-items: center; justify-content: center; gap: var(--ui-space-1); width: 100%; min-height: var(--ui-control-min-height); margin: 0; padding: 0 var(--ui-space-4); border: var(--ui-button-outline-border); border-radius: var(--ui-control-radius); background: var(--ui-button-outline-bg); color: var(--ui-color-text); font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-heading); line-height: var(--ui-line-height-compact); box-sizing: border-box; }
.hall-match-view::after { border: 0; }
.hall-match-view--pressed { background: var(--ui-control-subtle-bg); box-shadow: var(--ui-shadow-control-pressed); }
.hall-match-calendar, .hall-match-info, .hall-match-progress-hint { color: var(--ui-color-text-secondary); }
/* #endif */
</style>
