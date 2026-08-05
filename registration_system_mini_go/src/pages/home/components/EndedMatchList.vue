<script setup lang="ts">
import type { HomeEndedMatch } from "@/types/api";
import { formatDate } from "@/pages/home/useHomeMatches";

defineProps<{
  matches: HomeEndedMatch[];
}>();

defineEmits<{
  (event: "open", match: HomeEndedMatch): void;
}>();
</script>

<template>
  <view class="ended-list">
    <button v-for="match in matches" :key="match.id" class="ended-row" @click="$emit('open', match)">
      <text class="ended-date">{{ formatDate(match.start_time) }}</text>
      <view class="ended-copy">
        <text class="ended-title">{{ match.name }}</text>
        <text class="ended-location">{{ match.location }}</text>
      </view>
      <view class="ended-chevron" aria-hidden="true">›</view>
    </button>
  </view>
</template>

<style scoped lang="scss">
.ended-list {
  overflow: hidden;
  border: 2rpx solid var(--line);
  border-radius: 20rpx;
  background: var(--surface);
}

.ended-row {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 112rpx;
  grid-template-columns: 132rpx minmax(0, 1fr) 32rpx;
  align-items: center;
  gap: 16rpx;
  padding: 17rpx 22rpx;
  background: transparent;
  color: var(--ink);
  text-align: left;
}

.ended-row + .ended-row::before {
  position: absolute;
  top: 0;
  right: 22rpx;
  left: 22rpx;
  height: 2rpx;
  background: #ebeeea;
  content: "";
}

.ended-date {
  color: #6d776f;
  font-size: 21rpx;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.ended-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.ended-title,
.ended-location {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ended-title {
  font-size: 25rpx;
  font-weight: 850;
}

.ended-location {
  margin-top: 7rpx;
  color: var(--muted);
  font-size: 21rpx;
}

.ended-chevron {
  color: #8c958e;
  font-size: 38rpx;
  line-height: 1;
}
</style>
