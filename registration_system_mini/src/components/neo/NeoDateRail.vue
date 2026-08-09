<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  monthDayLabel: string;
  weekdayLabel: string;
  timeLabel: string;
  note?: string;
}>();

const timeLines = computed(() => {
  const parts = props.timeLabel.split(/[-–—]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) return [props.timeLabel];
  return [`${parts[0]}-`, parts[1]];
});
</script>

<template>
  <view class="neo-date-rail">
    <text class="neo-date-rail__month">{{ monthDayLabel }}</text>
    <text class="neo-date-rail__weekday">{{ weekdayLabel }}</text>
    <view class="neo-date-rail__time">
      <text
        v-for="(line, index) in timeLines"
        :key="`${line}-${index}`"
        class="neo-date-rail__time-value"
      >
        {{ line }}
      </text>
      <text v-if="note" class="neo-date-rail__note">{{ note }}</text>
    </view>
  </view>
</template>

<style scoped>
.neo-date-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: var(--neo-date-width);
  min-height: 240rpx;
  padding: 18rpx 16rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-date-radius);
  background: var(--neo-date-bg);
  color: var(--neo-date-fg);
}

.neo-date-rail__month {
  font-size: 28rpx;
  line-height: 1.2;
  font-weight: 800;
}

.neo-date-rail__weekday {
  margin-top: 8rpx;
  font-size: 46rpx;
  line-height: 1.1;
  font-weight: 900;
}

.neo-date-rail__time {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 72rpx;
  margin-top: auto;
  padding: 12rpx 8rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-date-time-bg);
  color: var(--neo-date-time-fg);
}

.neo-date-rail__time-value {
  width: 100%;
  font-size: 30rpx;
  line-height: 1.08;
  font-weight: 900;
  text-align: center;
  white-space: nowrap;
}

.neo-date-rail__note {
  margin-top: 5rpx;
  font-size: 20rpx;
  line-height: 1.2;
  font-weight: 800;
  text-align: center;
}
</style>
