<script setup lang="ts">
import NeoSurface from "@/components/neo/NeoSurface.vue";
import NeoTag from "@/components/neo/NeoTag.vue";
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
  <NeoSurface variant="raised">
    <view class="inherit-head">
      <text class="inherit-title">{{ detail.match.name }}</text>
      <view class="inherit-tags">
        <NeoTag tone="blue">球队约队</NeoTag>
        <NeoTag tone="amber">招对手中</NeoTag>
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

    <view class="inherit-note">以上信息由对方球队发布，接约时自动沿用，无需重复填写。</view>
  </NeoSurface>
</template>

<style scoped>
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
  font-weight: 900;
  color: var(--neo-color-text);
}

.inherit-tags {
  display: flex;
  gap: 8rpx;
  flex-shrink: 0;
}

.inherit-rows {
  margin-top: 20rpx;
  border-top: var(--neo-border-default);
}

.inherit-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  padding: 16rpx 0;
  border-bottom: var(--neo-border-default);
}

.inherit-row:last-child {
  border-bottom: none;
}

.inherit-row-label {
  flex-shrink: 0;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--neo-color-text-muted);
}

.inherit-row-value {
  flex: 1;
  text-align: right;
  font-size: 26rpx;
  font-weight: 800;
  color: var(--neo-color-text);
}

.inherit-note {
  margin-top: 18rpx;
  padding: 14rpx 18rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  font-size: 22rpx;
  line-height: 1.5;
  font-weight: 600;
  color: var(--neo-color-text-muted);
}
</style>
