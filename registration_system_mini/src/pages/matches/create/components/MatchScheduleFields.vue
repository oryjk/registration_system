<script setup lang="ts">
import { computed } from "vue";

// 比赛日期与起止时间：日期走近 7 日横滑卡 + 更多日期 picker，时间走两个 time picker。
// 日期变更时同步保持已选的开始/结束钟点。
const props = defineProps<{
  holdingDate: number;
  matchEndTime: number;
  timeValidMessage?: string;
}>();

const emit = defineEmits<{
  (event: "update:holdingDate", value: number): void;
  (event: "update:matchEndTime", value: number): void;
}>();

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parsePickerDate(value: number) {
  const date = value ? new Date(value) : new Date();
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function normalizeToMinute(timestamp: number) {
  const date = new Date(timestamp);
  date.setSeconds(0, 0);
  return date.getTime();
}

function displayTimeLabel(value: number) {
  if (!value) return "";
  const date = parsePickerDate(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatPickerDateValue(value: number) {
  const date = parsePickerDate(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatPickerTimeValue(value: number) {
  const date = parsePickerDate(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function mergeDate(baseValue: number, pickerValue: string) {
  const date = parsePickerDate(baseValue);
  const [year, month, day] = pickerValue.split("-").map((item) => Number(item));
  date.setFullYear(year, (month || 1) - 1, day || 1);
  return normalizeToMinute(date.getTime());
}

function mergeTime(baseValue: number, pickerValue: string, fallbackBase: number) {
  const date = new Date(baseValue || fallbackBase);
  const [hour, minute] = pickerValue.split(":").map((item) => Number(item));
  date.setHours(hour || 0, minute || 0, 0, 0);
  return normalizeToMinute(date.getTime());
}

function buildRecentDateOptions() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getTime() + index * 24 * 60 * 60 * 1000);
    const timestamp = date.getTime();
    return {
      value: timestamp,
      topLabel: index === 0 ? "今天" : ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()] ?? "",
      dayLabel: pad(date.getDate()),
      monthLabel: `${pad(date.getMonth() + 1)}月`,
      pickerValue: formatPickerDateValue(timestamp),
    };
  });
}

const recentDateOptions = computed(() => buildRecentDateOptions());
const selectedDateValue = computed(() => formatPickerDateValue(props.holdingDate));

function syncDate(nextDateTimestamp: number) {
  const nextHoldingDate = mergeTime(nextDateTimestamp, formatPickerTimeValue(props.holdingDate), Date.now());
  const nextMatchEndTime = mergeTime(nextDateTimestamp, formatPickerTimeValue(props.matchEndTime), Date.now());
  emit("update:holdingDate", nextHoldingDate);
  emit("update:matchEndTime", nextMatchEndTime);
}

function handleSelectDateOption(timestamp: number) {
  syncDate(timestamp);
}

function handleDatePickerChange(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  const nextValue = detail.detail?.value;
  if (!nextValue) return;
  syncDate(mergeDate(props.holdingDate, nextValue));
}

function handleMatchStartTimeChange(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  const nextValue = detail.detail?.value;
  if (!nextValue) return;
  emit("update:holdingDate", mergeTime(props.holdingDate, nextValue, props.holdingDate));
}

function handleMatchEndTimeChange(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  const nextValue = detail.detail?.value;
  if (!nextValue) return;
  emit("update:matchEndTime", mergeTime(props.matchEndTime, nextValue, props.holdingDate));
}
</script>

<template>
  <view>
    <view class="date-head">
      <text class="date-head-title">比赛日期</text>
      <picker mode="date" :value="selectedDateValue" @change="handleDatePickerChange">
        <view class="date-more-link">更多日期</view>
      </picker>
    </view>

    <scroll-view class="date-option-scroll" scroll-x>
      <view class="date-option-row">
        <view
          v-for="option in recentDateOptions"
          :key="option.pickerValue"
          :class="['date-option-card', selectedDateValue === option.pickerValue ? 'date-option-active' : '']"
          @tap="handleSelectDateOption(option.value)"
        >
          <text class="date-option-top">{{ option.topLabel }}</text>
          <text class="date-option-day">{{ option.dayLabel }}</text>
          <text class="date-option-month">{{ option.monthLabel }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="time-tile-grid">
      <picker mode="time" :value="formatPickerTimeValue(holdingDate)" @change="handleMatchStartTimeChange">
        <view class="time-tile">
          <text class="time-tile-label">比赛开始时间</text>
          <view class="time-tile-value-row">
            <text :class="['time-tile-value', !holdingDate ? 'time-tile-value-placeholder' : '']">
              {{ displayTimeLabel(holdingDate) || "请选择比赛开始时间" }}
            </text>
            <text class="time-tile-arrow">›</text>
          </view>
        </view>
      </picker>

      <picker mode="time" :value="formatPickerTimeValue(matchEndTime)" @change="handleMatchEndTimeChange">
        <view class="time-tile">
          <text class="time-tile-label">比赛结束时间</text>
          <view class="time-tile-value-row">
            <text :class="['time-tile-value', !matchEndTime ? 'time-tile-value-placeholder' : '']">
              {{ displayTimeLabel(matchEndTime) || "请选择比赛结束时间" }}
            </text>
            <text class="time-tile-arrow">›</text>
          </view>
        </view>
      </picker>
    </view>

    <view v-if="timeValidMessage" class="form-error">
      {{ timeValidMessage }}
    </view>
  </view>
</template>

<style scoped>
.date-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 26rpx;
}

.date-head-title {
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
}

.date-more-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 56rpx;
  padding: 0 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 22rpx;
  font-weight: 800;
}

.date-option-scroll {
  margin-top: 18rpx;
  white-space: nowrap;
}

.date-option-row {
  display: inline-flex;
  gap: 14rpx;
  padding-right: 4rpx;
}

.date-option-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 132rpx;
  min-height: 164rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-sizing: border-box;
}

.date-option-active {
  border: var(--neo-border-strong);
  background: var(--neo-color-accent);
  box-shadow: 4rpx 4rpx 0 var(--neo-color-text);
}

.date-option-top {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 800;
  line-height: 1.2;
}

.date-option-day {
  margin-top: 10rpx;
  color: var(--neo-color-text);
  font-size: 56rpx;
  font-weight: 900;
  line-height: 1;
}

.date-option-month {
  margin-top: 8rpx;
  color: var(--neo-color-text-muted);
  font-size: 20rpx;
  font-weight: 700;
}

.date-option-active .date-option-top,
.date-option-active .date-option-month {
  color: var(--neo-color-text);
}

.time-tile-grid {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 22rpx;
}

.time-tile {
  width: 100%;
  min-height: 108rpx;
  padding: 18rpx 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 180rpx minmax(0, 1fr) auto;
  align-items: center;
  gap: 18rpx;
}

.time-tile-label {
  display: block;
  color: var(--neo-color-text);
  font-size: 26rpx;
  font-weight: 900;
  line-height: 1.25;
}

.time-tile-value-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.time-tile-value {
  min-width: 0;
  flex: 1;
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.time-tile-value-placeholder {
  color: var(--neo-color-text-disabled);
}

.time-tile-arrow {
  flex: 0 0 auto;
  color: var(--neo-color-text-muted);
  font-size: 44rpx;
  font-weight: 700;
  line-height: 1;
}

.form-error {
  margin-top: 16rpx;
  color: var(--neo-color-danger);
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.45;
}
</style>
