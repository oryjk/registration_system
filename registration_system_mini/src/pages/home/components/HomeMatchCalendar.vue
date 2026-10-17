<script setup lang="ts">
defineProps<{ month: string; day: string; weekday: string }>();
</script>

<template>
  <view class="match-calendar" :aria-label="`${month}${day}日 ${weekday}`">
    <text class="match-calendar__month">{{ month }}</text>
    <text class="match-calendar__day">{{ day }}</text>
    <text v-if="weekday" class="match-calendar__weekday">{{ weekday }}</text>
  </view>
</template>

<style scoped>
.match-calendar {
  display: flex;
  flex-direction: column;
  width: 86rpx;
  overflow: hidden;
  border-radius: 14rpx;
  background: var(--now-calendar-surface);
  color: var(--now-calendar-fg);
  text-align: center;
  box-shadow: var(--ui-shadow-soft);
}
.match-calendar__month { padding: 4rpx 0; background: var(--now-calendar-accent); color: var(--now-calendar-on-accent); font-size: 22rpx; line-height: 1.5; font-weight: 600; }
.match-calendar__day { padding-top: 6rpx; font-size: 44rpx; line-height: 1.2; font-weight: 600; font-variant-numeric: tabular-nums; }
.match-calendar__weekday { padding-bottom: 8rpx; color: var(--now-calendar-muted); font-size: 22rpx; line-height: 1.5; }
</style>
