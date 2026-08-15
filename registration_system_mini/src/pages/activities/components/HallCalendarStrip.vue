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
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  transition: transform var(--neo-motion-fast), box-shadow var(--neo-motion-fast);
}

.hall-calendar-item-active {
  background: var(--neo-color-text);
  box-shadow: var(--neo-shadow-pressed);
}

.hall-calendar-badge {
  font-size: 20rpx;
  font-weight: 700;
  color: var(--neo-color-text-muted);
}

.hall-calendar-item-active .hall-calendar-badge {
  color: var(--neo-color-accent);
}

.hall-calendar-day {
  font-size: 34rpx;
  font-weight: 900;
  color: var(--neo-color-text);
}

.hall-calendar-item-active .hall-calendar-day {
  color: var(--neo-color-text-inverse);
}
</style>
