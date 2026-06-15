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
  <view :class="['stats-card', embedded ? 'stats-card-embedded' : '']">
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
      <view v-for="month in calendarMonths" :key="month.monthKey" class="calendar-month-card">
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
          <view v-for="record in selectedRecords" :key="record.activityId" class="calendar-popup-item">
            <text class="calendar-popup-match">{{ record.activityName }}</text>
            <text class="calendar-popup-location">{{ record.location }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.stats-card {
  margin-top: 16rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: #ffffff;
  border: 1rpx solid rgba(31, 35, 26, 0.07);
  box-shadow: 0 14rpx 32rpx rgba(20, 24, 16, 0.05);
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
  color: #151812;
  font-weight: 900;
}

.stats-card-caption {
  display: block;
  margin-top: 8rpx;
  font-size: 21rpx;
  color: #747b70;
  font-weight: 700;
}

.calendar-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 9rpx;
  max-width: 300rpx;
  color: #4f5848;
  font-size: 24rpx;
  font-weight: 950;
}

.legend-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 999rpx;
  flex-shrink: 0;
}

.legend-dot-joined {
  background: #9be22b;
}

.legend-dot-leave {
  background: #ffbf3f;
}

.legend-dot-unchecked {
  background: #ff4d3d;
}

.calendar-months {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 18rpx;
}

.calendar-month-card {
  padding: 18rpx;
  border-radius: 25rpx;
  background: linear-gradient(180deg, #fbfcf8 0%, #f2f5ec 100%);
  border: 1rpx solid rgba(35, 43, 25, 0.08);
}

.calendar-month-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.calendar-month-title {
  display: block;
  color: #171a13;
  font-size: 29rpx;
  font-weight: 950;
}

.calendar-month-caption {
  display: block;
  margin-top: 5rpx;
  color: #778071;
  font-size: 20rpx;
  font-weight: 750;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  margin-top: 18rpx;
  padding: 0 2rpx;
}

.calendar-weekday {
  color: #8a9185;
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
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.72);
  border: 1rpx solid rgba(37, 45, 28, 0.05);
  box-sizing: border-box;
}

.calendar-day-muted {
  opacity: 0.28;
}

.calendar-day-match {
  background: #ffffff;
  border-color: rgba(105, 135, 38, 0.18);
  box-shadow: 0 8rpx 18rpx rgba(45, 58, 24, 0.06);
  transform: translateY(-1rpx);
}

.calendar-day-joined {
  background: #9be22b;
  border-color: rgba(80, 112, 0, 0.22);
  box-shadow: 0 12rpx 22rpx rgba(117, 179, 0, 0.24);
}

.calendar-day-leave {
  background: #ffbf3f;
  border-color: rgba(158, 98, 0, 0.24);
  box-shadow: 0 12rpx 22rpx rgba(230, 142, 0, 0.2);
}

.calendar-day-unchecked {
  background: #ff4d3d;
  border-color: rgba(139, 24, 16, 0.24);
  box-shadow: 0 12rpx 22rpx rgba(230, 52, 40, 0.2);
}

.calendar-day-today {
  border-color: rgba(16, 17, 15, 0.38);
}

.calendar-day-number {
  display: block;
  color: #252a20;
  font-size: 38rpx;
  font-weight: 900;
  line-height: 1;
  text-align: center;
}

.calendar-day-joined .calendar-day-number,
.calendar-day-leave .calendar-day-number,
.calendar-day-unchecked .calendar-day-number {
  color: #141711;
}

.calendar-day-unchecked .calendar-day-number {
  color: #ffffff;
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
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.45);
  color: #303724;
  font-size: 17rpx;
  font-weight: 1000;
  line-height: 1;
  text-align: center;
}

.calendar-day-unchecked .calendar-more {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.2);
}

.stats-empty {
  margin-top: 18rpx;
  padding: 24rpx;
  border-radius: 22rpx;
  background: #ffffff;
  color: #6c7168;
  font-size: 27rpx;
  line-height: 1.6;
}

.stats-empty-inner {
  margin-top: 16rpx;
  background: #f7f8f3;
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
  background: rgba(14, 17, 12, 0.34);
  box-sizing: border-box;
}

.calendar-popup {
  width: 100%;
  max-height: 58vh;
  padding: 26rpx;
  border-radius: 30rpx;
  background: #fbfcf8;
  box-shadow: 0 -18rpx 48rpx rgba(15, 18, 12, 0.18);
  box-sizing: border-box;
}

.calendar-popup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.calendar-popup-title {
  color: #151812;
  font-size: 31rpx;
  font-weight: 950;
}

.calendar-popup-close {
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: #edf1e8;
  color: #5e6759;
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
  border-radius: 22rpx;
  background: #ffffff;
  border: 1rpx solid rgba(31, 35, 26, 0.07);
}

.calendar-popup-match {
  display: block;
  color: #171a13;
  font-size: 28rpx;
  font-weight: 950;
}

.calendar-popup-location {
  display: block;
  margin-top: 8rpx;
  color: #727a6d;
  font-size: 23rpx;
  font-weight: 750;
  line-height: 1.35;
}
</style>
