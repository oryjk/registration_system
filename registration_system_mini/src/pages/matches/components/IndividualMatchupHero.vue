<script setup lang="ts">
import { computed } from "vue";
import type { BackendActivity } from "@/types/backend";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import NeoTag from "@/components/neo/NeoTag.vue";
import { formatMonthDayLabel, formatWeekdayLabel } from "@/utils/datetime";

const props = defineProps<{
  match: BackendActivity;
  matchKindLabel: string;
  homeTeamLabel: string;
  displayOpponentLabel: string;
  homeTeamColor: string;
  awayTeamColor: string;
  matchClockLabel: string;
  matchLocation: string;
}>();

defineEmits<{
  openLocation: [];
}>();

const dateBlockDay = computed(() => formatMonthDayLabel(props.match.holding_date));
const dateBlockWeekday = computed(() => formatWeekdayLabel(props.match.holding_date));

// 终态标识只看真实比赛状态：ended/cancelled 才显示；
// 仅时间已过但状态未收敛（等待队长收尾）不显示，与首页“已结束”分区的时间推断区分开。
const matchStatusTag = computed(() => {
  if (props.match.status === 2) return "已完成";
  if (props.match.status === 3) return "已取消";
  return "";
});
</script>

<template>
  <NeoSurface custom-class="hero-scoreboard">
    <view class="hero-head">
      <view class="hero-dateblock">
        <view class="hero-dateblock-top">
          <text class="hero-dateblock-day">{{ dateBlockDay }}</text>
          <text class="hero-dateblock-weekday">{{ dateBlockWeekday }}</text>
        </view>
        <view class="hero-dateblock-time">{{ matchClockLabel }}</view>
      </view>
      <view class="hero-heading">
        <view class="hero-tags">
          <NeoTag tone="lime" size="sm">{{ matchKindLabel }}</NeoTag>
          <NeoTag v-if="matchStatusTag" tone="muted" size="sm">{{ matchStatusTag }}</NeoTag>
        </view>
        <text class="hero-title">{{ match.name }}</text>
      </view>
    </view>

    <view class="hero-board">
      <view class="hero-team">
        <view class="hero-flag" :style="{ backgroundColor: homeTeamColor }" />
        <view class="hero-team-info">
          <text class="hero-role">主队</text>
          <text class="hero-name">{{ homeTeamLabel }}</text>
        </view>
      </view>
      <view v-if="match.host_score != null && match.away_score != null" class="hero-score">
        <text class="hero-score-number">{{ match.host_score }}</text>
        <text class="hero-score-colon">:</text>
        <text class="hero-score-number">{{ match.away_score }}</text>
      </view>
      <text v-else class="hero-vs">VS</text>
      <view class="hero-team hero-team-away">
        <view class="hero-flag" :style="{ backgroundColor: awayTeamColor }" />
        <view class="hero-team-info">
          <text class="hero-role">客队</text>
          <text class="hero-name">{{ displayOpponentLabel }}</text>
        </view>
      </view>
    </view>

    <view class="hero-foot">
      <view class="hero-kits">
        <view class="hero-kit">
          <view class="hero-kit-dot" :style="{ backgroundColor: homeTeamColor }" />
          <text class="hero-kit-label">主队球服</text>
        </view>
        <view class="hero-kit">
          <view class="hero-kit-dot" :style="{ backgroundColor: awayTeamColor }" />
          <text class="hero-kit-label">客队球服</text>
        </view>
      </view>
      <view class="hero-venue" @tap="$emit('openLocation')">
        <text class="hero-venue-text">{{ matchLocation }}</text>
        <text
          v-if="matchLocation && match.location_latitude != null && match.location_longitude != null"
          class="hero-venue-arrow"
        >›</text>
      </view>
    </view>
  </NeoSurface>
</template>

<style scoped>
.hero-scoreboard {
  padding: 28rpx 32rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
  box-sizing: border-box;
}

.hero-head {
  display: flex;
  align-items: stretch;
  gap: 24rpx;
}

.hero-dateblock {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  box-shadow: 6rpx 6rpx 0 var(--neo-color-text);
  overflow: hidden;
}

.hero-dateblock-top {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 14rpx 20rpx 10rpx;
  background: var(--neo-color-text);
  color: var(--neo-color-text-inverse);
}

.hero-dateblock-day {
  font-size: 28rpx;
  line-height: 1.15;
  font-weight: 900;
}

.hero-dateblock-weekday {
  font-size: 22rpx;
  line-height: 1.2;
  font-weight: 800;
}

.hero-dateblock-time {
  padding: 10rpx 20rpx 12rpx;
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  border-top: var(--neo-border-strong);
  font-size: 30rpx;
  line-height: 1;
  font-weight: 900;
  text-align: center;
  letter-spacing: 2rpx;
}

.hero-heading {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 10rpx;
  min-width: 0;
}

.hero-tags {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.hero-title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: 48rpx;
  line-height: 1.15;
  color: var(--neo-color-text);
  font-weight: 900;
}

.hero-board {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 20rpx;
  margin-top: 28rpx;
  padding: 24rpx 0;
  border-top: var(--neo-border-strong);
  border-bottom: var(--neo-border-strong);
}

.hero-team {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-width: 0;
}

.hero-team-away {
  flex-direction: row-reverse;
  text-align: right;
}

.hero-team-away .hero-team-info {
  align-items: flex-end;
}

.hero-flag {
  width: 14rpx;
  align-self: stretch;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  flex-shrink: 0;
}

.hero-team-info {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}

.hero-role {
  font-size: 22rpx;
  line-height: 1;
  color: var(--neo-color-text-muted);
  font-weight: 900;
}

.hero-name {
  font-size: 36rpx;
  line-height: 1.15;
  color: var(--neo-color-text);
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.hero-vs {
  font-size: 44rpx;
  line-height: 1;
  color: var(--neo-color-text);
  font-weight: 900;
  letter-spacing: 2rpx;
}

.hero-score {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.hero-score-number {
  font-size: 52rpx;
  line-height: 1;
  color: var(--neo-color-text);
  font-weight: 900;
}

.hero-score-colon {
  font-size: 40rpx;
  line-height: 1;
  color: var(--neo-color-text-muted);
  font-weight: 900;
}

.hero-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 24rpx;
}

.hero-kits {
  display: flex;
  align-items: center;
  gap: 24rpx;
  min-width: 0;
}

.hero-kit {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.hero-kit-dot {
  width: 20rpx;
  height: 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  flex-shrink: 0;
  box-sizing: border-box;
}

.hero-kit-label {
  font-size: 22rpx;
  line-height: 1;
  color: var(--neo-color-text-muted);
  font-weight: 800;
  white-space: nowrap;
}

.hero-venue {
  display: flex;
  align-items: center;
  gap: 4rpx;
  min-width: 0;
}

.hero-venue-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 26rpx;
  line-height: 1.25;
  color: var(--neo-color-text);
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 6rpx;
}

.hero-venue-arrow {
  flex-shrink: 0;
  font-size: 30rpx;
  line-height: 1;
  font-weight: 900;
}
</style>
