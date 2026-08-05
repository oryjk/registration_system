<script setup lang="ts">
import { computed } from "vue";
import type { HomeActionMatch } from "@/types/api";
import {
  formatMonthDay,
  formatTime,
  formatWeekday,
  matchActionLabel,
  matchProgress,
  matchTarget,
  opponentName,
  registrationLabel,
  startHint,
} from "@/pages/home/useHomeMatches";

const props = defineProps<{
  match: HomeActionMatch;
}>();

defineEmits<{
  (event: "open", match: HomeActionMatch): void;
}>();

const progress = computed(() => matchProgress(props.match));
const target = computed(() => matchTarget(props.match));
</script>

<template>
  <view class="match-card">
    <view class="match-topline">
      <view class="date-block">
        <text class="date-number">{{ formatMonthDay(match.start_time) }}</text>
        <text class="weekday">{{ formatWeekday(match.start_time) }}</text>
      </view>

      <view class="match-heading">
        <view class="heading-line">
          <text class="match-title">{{ match.name }}</text>
          <text class="status-tag" :class="{ ongoing: match.status === 'ongoing' }">
            {{ match.status === "ongoing" ? "进行中" : "待处理" }}
          </text>
        </view>
        <text class="start-hint">{{ startHint(match) }}</text>
      </view>
    </view>

    <view class="match-facts">
      <view class="fact-line">
        <view class="fact-icon pin-icon" aria-hidden="true" />
        <text>{{ match.location }}</text>
      </view>
      <view class="fact-line">
        <view class="fact-icon team-icon" aria-hidden="true" />
        <text>{{ match.players_per_team }} 人制 · 对手 {{ opponentName(match) }}</text>
      </view>
    </view>

    <view class="progress-block">
      <view class="progress-copy">
        <text>报名进度</text>
        <text class="progress-number">{{ match.group.attending_count }}/{{ target }}</text>
      </view>
      <view class="progress-track">
        <view class="progress-fill" :style="{ width: `${progress}%` }" />
      </view>
    </view>

    <view class="match-footer">
      <view class="my-status">
        <view class="status-dot" :class="match.group.my_registration_status || 'none'" />
        <text>我的状态：{{ registrationLabel(match.group.my_registration_status) }}</text>
      </view>
      <button class="match-action" @click="$emit('open', match)">{{ matchActionLabel(match) }}</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.match-card {
  padding: 26rpx;
  border: 2rpx solid var(--line);
  border-radius: 22rpx;
  background: var(--surface);
  box-shadow: 0 12rpx 30rpx rgba(19, 37, 26, 0.08);
}

.match-topline {
  display: flex;
  align-items: stretch;
  gap: 22rpx;
}

.date-block {
  display: flex;
  width: 112rpx;
  min-width: 112rpx;
  min-height: 106rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border-radius: 16rpx;
  background: var(--ink);
  color: #fff;
}

.date-number,
.progress-number {
  font-variant-numeric: tabular-nums;
}

.date-number {
  color: var(--accent);
  font-size: 28rpx;
  font-weight: 900;
}

.weekday {
  margin-top: 5rpx;
  font-size: 25rpx;
  font-weight: 800;
}

.match-heading {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  justify-content: center;
}

.heading-line {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 12rpx;
}

.match-title {
  min-width: 0;
  flex: 1;
  font-size: 31rpx;
  font-weight: 900;
  line-height: 1.25;
}

.status-tag {
  flex: none;
  padding: 7rpx 12rpx;
  border-radius: 999rpx;
  background: #edf7dc;
  color: #416500;
  font-size: 19rpx;
  font-weight: 800;
}

.status-tag.ongoing {
  background: #fff0dd;
  color: #8b4d00;
}

.start-hint {
  margin-top: 12rpx;
  color: var(--muted);
  font-size: 22rpx;
  line-height: 1.35;
}

.match-facts {
  display: grid;
  gap: 11rpx;
  margin-top: 22rpx;
  padding: 18rpx 0;
  border-top: 2rpx solid #edf0ec;
  border-bottom: 2rpx solid #edf0ec;
}

.fact-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12rpx;
  color: #4f5a52;
  font-size: 23rpx;
  line-height: 1.4;
}

.fact-icon {
  position: relative;
  width: 24rpx;
  height: 24rpx;
  flex: none;
  color: #6d786f;
}

.pin-icon {
  border: 3rpx solid currentColor;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg) scale(0.72);
}

.team-icon::before,
.team-icon::after {
  position: absolute;
  border: 3rpx solid currentColor;
  border-radius: 50%;
  content: "";
}

.team-icon::before {
  top: 0;
  left: 4rpx;
  width: 11rpx;
  height: 11rpx;
}

.team-icon::after {
  right: 1rpx;
  bottom: 1rpx;
  left: 1rpx;
  height: 10rpx;
  border-radius: 12rpx 12rpx 3rpx 3rpx;
}

.progress-block {
  margin-top: 19rpx;
}

.progress-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #3d473f;
  font-size: 22rpx;
  font-weight: 750;
}

.progress-number {
  color: var(--ink);
  font-size: 24rpx;
  font-weight: 900;
}

.progress-track {
  overflow: hidden;
  height: 12rpx;
  margin-top: 11rpx;
  border-radius: 999rpx;
  background: #e8ede6;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 180ms ease-out;
}

.match-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 22rpx;
}

.my-status {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10rpx;
  color: #526057;
  font-size: 21rpx;
  font-weight: 700;
}

.status-dot {
  width: 13rpx;
  height: 13rpx;
  flex: none;
  border-radius: 50%;
  background: #a9b1ab;
}

.status-dot.attending {
  background: #3c8c4d;
}

.status-dot.leave,
.status-dot.absent {
  background: #c77c22;
}

.match-action {
  display: flex;
  width: 164rpx;
  min-width: 164rpx;
  min-height: 96rpx;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  background: var(--ink);
  color: #fff;
  font-size: 23rpx;
  font-weight: 850;
  line-height: 96rpx;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .progress-fill {
    transition: none;
  }
}
</style>
