<script setup lang="ts">
import AppSurface from "@/components/ui/AppSurface.vue";
import AppTag from "@/components/ui/AppTag.vue";
import type { AppMatchDetailResponse } from "@/types/match";
import { formatDateTimeWithWeekdayLabel } from "@/utils/datetime";

const props = defineProps<{
  detail: AppMatchDetailResponse;
}>();

const hostGroup = props.detail.groups.find((group) => group.kind === "host_team");
const hostProgressLabel = hostGroup?.max_players
  ? `${hostGroup.attending_count}/${hostGroup.max_players}`
  : "";
</script>

<template>
  <AppSurface variant="raised">
    <view class="inherit-head">
      <text class="inherit-title">{{ detail.match.name }}</text>
      <view class="inherit-tags">
        <AppTag tone="blue">球队约队</AppTag>
        <AppTag tone="amber">招对手中</AppTag>
      </view>
    </view>

    <view class="inherit-rows">
      <view class="inherit-row">
        <text class="inherit-row-label">比赛时间</text>
        <text class="inherit-row-value">{{ formatDateTimeWithWeekdayLabel(detail.match.start_time) }}</text>
      </view>
      <view class="inherit-row">
        <text class="inherit-row-label">比赛场地</text>
        <text class="inherit-row-value">{{ detail.match.location }}</text>
      </view>
      <view class="inherit-row">
        <text class="inherit-row-label">人数制式</text>
        <text class="inherit-row-value">{{ detail.match.players_per_team }} 人制</text>
      </view>
      <view class="inherit-row">
        <text class="inherit-row-label">发布球队</text>
        <text class="inherit-row-value">{{ detail.match.host_team_name }}</text>
      </view>
      <view v-if="hostProgressLabel" class="inherit-row">
        <text class="inherit-row-label">对方报名</text>
        <text class="inherit-row-value">{{ hostProgressLabel }} 人</text>
      </view>
    </view>

    <view class="inherit-note ui-soft-panel">以上信息由对方球队发布，接约时自动沿用，无需重复填写。</view>
  </AppSurface>
</template>

<style scoped>
@import "@/styles/list-surfaces.css";
.inherit-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14rpx;
}

.inherit-title {
  flex: 1;
  font-size: 32rpx;
  line-height: 1.35;
  font-weight: 600;
  color: var(--ui-color-text);
}

.inherit-tags {
  display: flex;
  gap: 8rpx;
  flex-shrink: 0;
}

.inherit-rows {
  margin-top: 20rpx;
  border-top: var(--ui-border-default);
}

.inherit-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  padding: 16rpx 0;
  border-bottom: var(--ui-border-default);
}

.inherit-row:last-child {
  border-bottom: none;
}

.inherit-row-label {
  flex-shrink: 0;
  font-size: 26rpx;
  font-weight: 400;
  color: var(--ui-color-text-muted);
}

.inherit-row-value {
  flex: 1;
  text-align: right;
  font-size: 26rpx;
  font-weight: 500;
  color: var(--ui-color-text);
}

.inherit-note {
  margin-top: 18rpx;
  padding: 14rpx 18rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-muted);
  font-size: 22rpx;
  line-height: 1.5;
  font-weight: 600;
  color: var(--ui-color-text-muted);
}

/* #ifdef MP-WEIXIN */
.inherit-rows { border-top: var(--ui-list-divider); }
.inherit-row:last-child { border-bottom: 0; }
.inherit-head { flex-wrap: wrap; gap: var(--ui-space-4); }
.inherit-title { min-width: 0; flex-basis: 100%; overflow-wrap: anywhere; font-size: var(--ui-text-title); line-height: var(--ui-line-height-compact); }
.inherit-tags { flex-wrap: wrap; gap: var(--ui-space-2); }
.inherit-row { border-bottom: var(--ui-list-divider); padding: var(--ui-space-4) 0; gap: var(--ui-space-4); }
.inherit-row-label, .inherit-row-value { font-size: var(--ui-text-body); line-height: var(--ui-line-height-body); }
.inherit-row-value { min-width: 0; overflow-wrap: anywhere; }
.inherit-note { border: var(--ui-panel-border); padding: var(--ui-space-4); background: var(--ui-panel-soft-bg); font-weight: var(--ui-font-weight-body); font-size: var(--ui-text-sm); line-height: var(--ui-line-height-body); }
.inherit-row-label, .inherit-note { color: var(--ui-color-text-secondary); }
/* #endif */
</style>
