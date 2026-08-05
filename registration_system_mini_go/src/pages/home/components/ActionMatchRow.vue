<script setup lang="ts">
import type { HomeActionMatch } from "@/types/api";
import { formatMonthDay, matchActionLabel, startHint } from "@/pages/home/useHomeMatches";

defineProps<{
  match: HomeActionMatch;
}>();

defineEmits<{
  (event: "open", match: HomeActionMatch): void;
}>();
</script>

<template>
  <view class="action-row">
    <view class="row-date">{{ formatMonthDay(match.start_time) }}</view>
    <view class="row-copy">
      <text class="row-title">{{ match.name }}</text>
      <text class="row-note">{{ startHint(match) }}</text>
    </view>
    <button class="row-action" @click="$emit('open', match)">{{ matchActionLabel(match) }}</button>
  </view>
</template>

<style scoped lang="scss">
.action-row {
  display: grid;
  grid-template-columns: 86rpx minmax(0, 1fr) 132rpx;
  min-height: 112rpx;
  align-items: center;
  gap: 17rpx;
  padding: 16rpx 20rpx;
  border: 2rpx solid var(--line);
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.8);
}

.row-date {
  font-size: 23rpx;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.row-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.row-title {
  overflow: hidden;
  font-size: 25rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-note {
  overflow: hidden;
  margin-top: 7rpx;
  color: var(--muted);
  font-size: 19rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-action {
  display: flex;
  width: 132rpx;
  min-height: 96rpx;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #cfd6cf;
  border-radius: 10rpx;
  background: #fff;
  color: var(--ink);
  font-size: 21rpx;
  font-weight: 800;
  line-height: 84rpx;
  white-space: nowrap;
}
</style>
