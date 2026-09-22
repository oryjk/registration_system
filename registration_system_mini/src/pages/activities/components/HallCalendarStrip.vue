<script setup lang="ts">
import type { HallCalendarDay } from "../hallMatchState";

defineProps<{
  days: HallCalendarDay[];
  selectedKey: string;
}>();

const emit = defineEmits<{
  (event: "select", key: string): void;
}>();
</script>

<template>
  <scroll-view class="hall-calendar" scroll-x :show-scrollbar="false">
    <view class="hall-calendar-track">
      <view
        :class="['hall-calendar-item', selectedKey === '' ? 'hall-calendar-item-active' : '']"
        @tap="emit('select', '')"
      >
        <text class="hall-calendar-badge">全部</text>
        <text class="hall-calendar-day">不限</text>
      </view>
      <view
        v-for="day in days"
        :key="day.key"
        :class="['hall-calendar-item', selectedKey === day.key ? 'hall-calendar-item-active' : '']"
        @tap="emit('select', day.key)"
      >
        <text class="hall-calendar-badge">{{ day.badgeLabel }}</text>
        <text class="hall-calendar-day">{{ day.dayNumber }}</text>
      </view>
    </view>
  </scroll-view>
</template>

<style scoped>
.hall-calendar {
  width: 100%;
  white-space: nowrap;
}

.hall-calendar-track {
  display: inline-flex;
  gap: 14rpx;
  padding: 4rpx;
}

.hall-calendar-item {
  display: flex;
  width: 104rpx;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  padding: 14rpx 0;
  border: 2rpx solid var(--ui-color-line);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  box-sizing: border-box;
  transition: background-color var(--ui-motion-switch-duration) var(--ui-motion-ease-out), color var(--ui-motion-switch-duration) var(--ui-motion-ease-out), border-color var(--ui-motion-switch-duration) var(--ui-motion-ease-out);
}

.hall-calendar-item-active {
  border-color: var(--ui-color-text);
  background: var(--ui-color-text);
}

.hall-calendar-badge {
  font-size: 20rpx;
  font-weight: 400;
  color: var(--ui-color-text-muted);
}

.hall-calendar-item-active .hall-calendar-badge {
  color: var(--ui-color-accent-soft);
}

.hall-calendar-day {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--ui-color-text);
  font-variant-numeric: tabular-nums;
}

.hall-calendar-item-active .hall-calendar-day {
  color: var(--ui-color-text-inverse);
}
</style>
