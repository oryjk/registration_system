<script setup lang="ts">
import { computed, ref } from "vue";
import type { AttendanceCalendarDay, AttendanceCalendarMonth, AttendanceCalendarRecord } from "../teamStatsState";

defineProps<{
  myRecordsCount: number;
  calendarMonths: AttendanceCalendarMonth[];
  embedded?: boolean;
}>();

const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
const selectedDateKey = ref("");
const selectedRecords = ref<AttendanceCalendarRecord[]>([]);
const selectedTitle = computed(() => {
  if (!selectedDateKey.value) return "比赛信息";
  const [, month, day] = selectedDateKey.value.split("-");
  return `${Number(month)} 月 ${Number(day)} 日比赛`;
});

function openDayMatches(day: AttendanceCalendarDay) {
  if (!day.records.length) return;
  selectedDateKey.value = day.dateKey;
  selectedRecords.value = day.records;
}

function closeDayMatches() {
  selectedDateKey.value = "";
  selectedRecords.value = [];
}
</script>

<template>
  <view :class="['stats-card', embedded ? 'stats-card-embedded' : 'ui-card-panel']">
    <view class="stats-card-head">
      <view>
        <text class="stats-card-title">我的出勤日历</text>
        <text class="stats-card-caption">比赛日整格标注参加、请假和未打卡</text>
      </view>
      <view class="calendar-legend">
        <text class="legend-dot legend-dot-joined"></text>
        <text>参加</text>
        <text class="legend-dot legend-dot-leave"></text>
        <text>请假</text>
        <text class="legend-dot legend-dot-unchecked"></text>
        <text>未打卡</text>
      </view>
    </view>

    <view v-if="myRecordsCount" class="calendar-months">
      <view v-for="month in calendarMonths" :key="month.monthKey" class="calendar-month-card ui-list-row">
        <view class="calendar-month-head">
          <view>
            <text class="calendar-month-title">{{ month.title }}</text>
            <text class="calendar-month-caption">共 {{ month.total }} 场比赛</text>
          </view>
        </view>

        <view class="calendar-weekdays">
          <text v-for="item in weekDays" :key="item" class="calendar-weekday">{{ item }}</text>
        </view>

        <view class="calendar-grid">
          <view v-for="week in month.weeks" :key="week.days[0]?.dateKey" class="calendar-week">
            <view
              v-for="day in week.days"
              :key="day.dateKey"
              :class="[
                'calendar-day',
                !day.inMonth ? 'calendar-day-muted' : '',
                day.records.length ? 'calendar-day-match' : '',
                day.records[0] ? `calendar-day-${day.records[0].statusTone}` : '',
                day.isToday ? 'calendar-day-today' : '',
              ]"
              @tap="openDayMatches(day)"
            >
              <text class="calendar-day-number">{{ day.dayNumber }}</text>
              <view v-if="day.records.length" class="calendar-day-marks">
                <text v-if="day.records.length > 1" class="calendar-more">+{{ day.records.length - 1 }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
    <view v-else class="stats-empty stats-empty-inner">今年还没有球队比赛记录。</view>

    <view v-if="selectedRecords.length" class="calendar-popup-mask" @tap="closeDayMatches">
      <view class="calendar-popup" @tap.stop>
        <view class="calendar-popup-head">
          <text class="calendar-popup-title">{{ selectedTitle }}</text>
          <text class="calendar-popup-close" @tap="closeDayMatches">关闭</text>
        </view>
        <view class="calendar-popup-list">
          <view v-for="record in selectedRecords" :key="record.activityId" class="calendar-popup-item ui-list-row">
            <text class="calendar-popup-match">{{ record.activityName }}</text>
            <text class="calendar-popup-location">{{ record.location }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
@import "@/styles/list-surfaces.css";
.stats-card {
  margin-top: 16rpx;
  /* #ifndef MP-WEIXIN */
  padding: 22rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-raised);
  /* #endif */
}

.stats-card-embedded {
  margin-top: 0;
  padding: 0;
  border: 0;
  box-shadow: none;
}

.stats-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14rpx;
}

.stats-card-title {
  display: block;
  font-size: 31rpx;
  line-height: 1.2;
  color: var(--ui-color-text);
  font-weight: 600;
}

.stats-card-caption {
  display: block;
  margin-top: 8rpx;
  font-size: 21rpx;
  color: var(--ui-color-text-muted);
  font-weight: 400;
}

.calendar-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 9rpx;
  max-width: 300rpx;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: var(--ui-font-weight-heading);
}

.legend-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 999rpx;
  flex-shrink: 0;
}

.legend-dot-joined {
  border: var(--ui-border-default);
  background: var(--ui-color-accent);
  box-sizing: border-box;
}

.legend-dot-leave {
  border: var(--ui-border-default);
  background: var(--ui-color-warning-soft);
  box-sizing: border-box;
}

.legend-dot-unchecked {
  border: var(--ui-border-default);
  background: var(--ui-color-danger);
  box-sizing: border-box;
}

.calendar-months {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 18rpx;
}

.calendar-month-card {
  padding: 18rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-muted);
  box-shadow: var(--ui-shadow-card);
}

.calendar-month-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.calendar-month-title {
  display: block;
  color: var(--ui-color-text);
  font-size: 29rpx;
  font-weight: var(--ui-font-weight-heading);
}

.calendar-month-caption {
  display: block;
  margin-top: 5rpx;
  color: var(--ui-color-text-muted);
  font-size: 20rpx;
  font-weight: 600;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  margin-top: 18rpx;
  padding: 0 2rpx;
}

.calendar-weekday {
  color: var(--ui-color-text-muted);
  font-size: 19rpx;
  font-weight: 850;
  text-align: center;
}

.calendar-grid {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 9rpx;
}

.calendar-week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 9rpx;
}

.calendar-day {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96rpx;
  padding: 9rpx 6rpx;
  border-radius: var(--ui-radius-xs);
  background: var(--ui-color-surface-translucent);
  border: 2rpx solid var(--ui-color-track);
  box-sizing: border-box;
}

.calendar-day-muted {
  opacity: 0.28;
}

.calendar-day-match {
  background: var(--ui-color-surface);
  border-color: var(--ui-color-text);
}

.calendar-day-joined {
  background: var(--ui-color-accent);
  border-color: var(--ui-color-text);
}

.calendar-day-leave {
  background: var(--ui-color-warning-soft);
  border-color: var(--ui-color-text);
}

.calendar-day-unchecked {
  background: var(--ui-color-danger);
  border-color: var(--ui-color-text);
}

.calendar-day-today {
  border-color: var(--ui-color-text);
  box-shadow: var(--ui-shadow-card);
}

.calendar-day-number {
  display: block;
  color: var(--ui-color-text);
  font-size: 38rpx;
  font-weight: 600;
  line-height: 1;
  text-align: center;
}

.calendar-day-joined .calendar-day-number,
.calendar-day-leave .calendar-day-number,
.calendar-day-unchecked .calendar-day-number {
  color: var(--ui-color-text);
}

.calendar-day-unchecked .calendar-day-number {
  color: var(--ui-color-text-inverse);
}

.calendar-day-marks {
  position: absolute;
  right: 8rpx;
  bottom: 7rpx;
}

.calendar-more {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28rpx;
  height: 24rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-surface-translucent);
  color: var(--ui-color-text);
  font-size: 17rpx;
  font-weight: 1000;
  line-height: 1;
  text-align: center;
}

.calendar-day-unchecked .calendar-more {
  color: var(--ui-color-text-inverse);
  background: var(--ui-color-overlay);
}

.stats-empty {
  margin-top: 18rpx;
  padding: 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-muted);
  color: var(--ui-color-text-muted);
  font-size: 27rpx;
  font-weight: 400;
  line-height: 1.6;
}

.stats-empty-inner {
  margin-top: 16rpx;
}

.calendar-popup-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 80;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 28rpx;
  background: var(--ui-color-overlay);
  box-sizing: border-box;
}

.calendar-popup {
  width: 100%;
  max-height: 58vh;
  padding: 26rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-modal);
  box-sizing: border-box;
}

.calendar-popup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.calendar-popup-title {
  color: var(--ui-color-text);
  font-size: 31rpx;
  font-weight: var(--ui-font-weight-heading);
}

.calendar-popup-close {
  padding: 8rpx 18rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-muted);
  color: var(--ui-color-text);
  font-size: 22rpx;
  font-weight: 850;
}

.calendar-popup-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 20rpx;
}

.calendar-popup-item {
  padding: 18rpx;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  border: var(--ui-border-default);
}

.calendar-popup-match {
  display: block;
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: var(--ui-font-weight-heading);
}

.calendar-popup-location {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-color-text-muted);
  font-size: 23rpx;
  font-weight: 600;
  line-height: 1.35;
}

/* #ifdef H5 */
.calendar-popup {
  max-width: 694rpx;
}
  /* #endif */

/* #ifdef MP-WEIXIN */
/* 微信端复用统一排版尺度；H5 保留原有样式。 */
.stats-card { margin-top: var(--ui-card-gap); }
.stats-card-embedded { margin-top: 0; padding: 0; border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); background: transparent; box-shadow: var(--ui-panel-shadow); }
.stats-card-head { gap: var(--ui-space-3); }
.stats-card-title { font-size: var(--ui-text-title); line-height: var(--ui-line-height-tight); font-weight: var(--ui-font-weight-heading); }
.stats-card-caption { margin-top: var(--ui-space-2); font-size: var(--ui-text-xs); font-weight: var(--ui-font-weight-body); }
.calendar-legend { gap: var(--ui-space-2); font-size: var(--ui-text-body); }
.calendar-months { gap: var(--ui-section-gap); margin-top: var(--ui-space-4); }
.calendar-month-card { padding: var(--ui-list-row-padding) 0; border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); background: transparent; box-shadow: var(--ui-panel-shadow); }
.calendar-month-head { gap: var(--ui-space-3); }
.calendar-month-title { font-size: var(--ui-text-subtitle); }
.calendar-month-caption { margin-top: var(--ui-space-1); font-size: var(--ui-text-xs); font-weight: var(--ui-font-weight-heading); }
.calendar-weekdays { margin-top: var(--ui-space-4); padding: 0 var(--ui-space-1); }
.calendar-weekday { font-size: var(--ui-text-xs); }
.calendar-grid { gap: var(--ui-space-2); margin-top: var(--ui-space-2); }
.calendar-week { gap: var(--ui-space-2); }
.calendar-day { padding: var(--ui-space-2) var(--ui-space-1); border: var(--ui-panel-border); background: var(--ui-color-neutral-bg); }
.calendar-day-number { font-size: var(--ui-text-display); font-weight: var(--ui-font-weight-heading); }
.calendar-more { font-size: var(--ui-text-xs); font-weight: var(--ui-font-weight-heading); }
.stats-empty { margin-top: var(--ui-space-4); padding: var(--ui-panel-padding) 0; font-size: var(--ui-text-label); font-weight: var(--ui-font-weight-body); line-height: var(--ui-line-height-body); border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); background: transparent; }
.stats-empty-inner { margin-top: var(--ui-space-4); }
.calendar-popup-mask { padding: var(--ui-space-7); }
.calendar-popup { padding: var(--ui-panel-padding); border: var(--ui-panel-border); }
.calendar-popup-head { gap: var(--ui-space-4); }
.calendar-popup-title { font-size: var(--ui-text-title); }
.calendar-popup-close { padding: var(--ui-space-2) var(--ui-space-4); font-size: var(--ui-text-sm); border: var(--ui-control-border); background: var(--ui-control-subtle-bg); border-radius: var(--ui-control-radius); }
.calendar-popup-list { gap: 0; margin-top: var(--ui-space-5); }
.calendar-popup-item { padding: var(--ui-list-row-padding) 0; border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); }
.calendar-popup-match { font-size: var(--ui-text-subtitle); }
.calendar-popup-location { margin-top: var(--ui-space-2); font-size: var(--ui-text-sm); font-weight: var(--ui-font-weight-heading); line-height: var(--ui-line-height-tight); }
.calendar-month-card + .calendar-month-card { border-top: var(--ui-list-divider); }
.calendar-day-match { background: var(--ui-color-surface); }
.calendar-day-joined { background: var(--ui-color-accent); }
.calendar-day-leave { background: var(--ui-color-warning-soft); }
.calendar-day-unchecked { background: var(--ui-color-danger); }
.calendar-day-today { border: var(--ui-border-hairline); box-shadow: var(--ui-panel-shadow); }
.legend-dot { border: var(--ui-panel-border); }
.calendar-popup-item + .calendar-popup-item { border-top: var(--ui-list-divider); }
/* #endif */
</style>
