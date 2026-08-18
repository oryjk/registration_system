<script setup lang="ts">
import { computed } from "vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSegmentedControl from "@/components/neo/NeoSegmentedControl.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import type { NeoSegmentOption } from "@/components/neo/NeoSegmentedControl.vue";
import type { MatchPublishFormModel } from "./matchPublishForm";
import type { AppMatchPublicationMode } from "@/types/match";
import { MATCH_PUBLICATION_MODE_OPTIONS } from "@/utils/matchPublicationMode";

const props = withDefaults(
  defineProps<{
    modelValue: MatchPublishFormModel;
    mode?: "match" | "challenge";
    timeValidMessage?: string;
    showCheckIn?: boolean;
  }>(),
  {
    mode: "match",
    timeValidMessage: "",
    showCheckIn: true,
  },
);

const emit = defineEmits<{
  (event: "update:modelValue", value: MatchPublishFormModel): void;
  (event: "locationInput"): void;
  (event: "chooseLocation"): void;
}>();

const form = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const isChallenge = computed(() => props.mode === "challenge");
const titleLabel = computed(() => (isChallenge.value ? "约队标题" : "比赛名称"));
const titlePlaceholder = computed(() => (isChallenge.value ? "例如：周五晚 8 人制约队" : "例如：周五晚友谊赛"));
const playersLabel = computed(() => (isChallenge.value ? "人数" : "比赛人制"));
const playersPlaceholder = computed(() => (isChallenge.value ? "8" : "例如：8"));
const colorLabel = computed(() => (isChallenge.value ? "主队球服" : "本队球服"));
const opposingColorLabel = computed(() => (isChallenge.value ? "对手球服" : "对方球服"));
const descriptionLabel = computed(() => (isChallenge.value ? "备注" : "说明"));
const descriptionPlaceholder = computed(() =>
  isChallenge.value ? "例如：强度中高，守时优先" : "可选补充场地、人数、集合要求",
);
const locationCaption = computed(() =>
  isChallenge.value ? "可直接输入文字地址，也可以使用地图选择场地。" : "可直接输入文字地址；启用签到时请用地图选择经纬度。",
);
const colorOptions = [
  { name: "深蓝", value: "#2F6BFF" },
  { name: "荧光绿", value: "#C8FF00" },
  { name: "橙红", value: "#FF6B35" },
  { name: "紫红", value: "#B34DFF" },
  { name: "墨黑", value: "#111310" },
  { name: "白银", value: "#D8DDE6" },
];

const publicationModeOptions = computed<NeoSegmentOption[]>(() =>
  MATCH_PUBLICATION_MODE_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
);
const selectedPublicationModeDescription = computed(
  () => MATCH_PUBLICATION_MODE_OPTIONS.find((option) => option.value === form.value.publicationMode)?.description ?? "",
);

function updateField<K extends keyof MatchPublishFormModel>(key: K, value: MatchPublishFormModel[K]) {
  form.value[key] = value;
  emit("update:modelValue", form.value);
}

function setColorField(key: "color" | "opposingColor", value: string) {
  updateField(key, value);
}

function handlePublicationModeChange(value: string) {
  selectPublicationMode(value as AppMatchPublicationMode);
}

function selectPublicationMode(value: AppMatchPublicationMode) {
  updateField("publicationMode", value);
  if (value !== "offline_confirmed") {
    updateField("opposing", "");
  }
}

function handleCheckInSwitchChange(event: Event) {
  const detail = event as Event & { detail?: { value?: boolean } };
  updateField("enableCheckIn", !!detail.detail?.value);
}

function handleLocationInput() {
  emit("locationInput");
}

function handleChooseLocation() {
  emit("chooseLocation");
}

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

function displayDateLabel(value: number) {
  if (!value) return "";
  const date = parsePickerDate(value);
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()] ?? "";
  return `${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${weekday}`;
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

function mergeTime(baseValue: number, pickerValue: string) {
  const date = new Date(baseValue || form.value.holdingDate);
  const [hour, minute] = pickerValue.split(":").map((item) => Number(item));
  date.setHours(hour || 0, minute || 0, 0, 0);
  return normalizeToMinute(date.getTime());
}

function describeRelativeDay(index: number) {
  if (index === 0) return "今天";
  if (index === 1) return "明天";
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][index % 7] ?? "";
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
const selectedDateValue = computed(() => formatPickerDateValue(form.value.holdingDate));

function syncHoldingRelatedDate(nextDateTimestamp: number) {
  const currentStartClock = formatPickerTimeValue(form.value.holdingDate);
  const currentEndClock = formatPickerTimeValue(form.value.matchEndTime);
  const nextHoldingDate = mergeTime(nextDateTimestamp, currentStartClock);
  const nextMatchEndTime = mergeTime(nextDateTimestamp, currentEndClock);
  updateField("holdingDate", nextHoldingDate);
  updateField("matchEndTime", nextMatchEndTime);
}

function handleSelectDateOption(timestamp: number) {
  syncHoldingRelatedDate(timestamp);
}

function handleDatePickerChange(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  const nextValue = detail.detail?.value;
  if (!nextValue) return;
  syncHoldingRelatedDate(mergeDate(form.value.holdingDate, nextValue));
}

function handleMatchStartTimeChange(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  const nextValue = detail.detail?.value;
  if (!nextValue) return;
  updateField("holdingDate", mergeTime(form.value.holdingDate, nextValue));
}

function handleMatchEndTimeChange(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  const nextValue = detail.detail?.value;
  if (!nextValue) return;
  updateField("matchEndTime", mergeTime(form.value.matchEndTime || form.value.holdingDate, nextValue));
}
</script>

<template>
  <view class="publish-form">
    <NeoSurface custom-class="form-card">
      <NeoSectionHeader title="基础信息" marker="01" caption="比赛类型决定对手来源，球服颜色用于区分两队" />
      <view v-if="!isChallenge" class="form-field">
        <text class="form-label">比赛类型</text>
        <NeoSegmentedControl
          :model-value="form.publicationMode"
          :options="publicationModeOptions"
          @change="handlePublicationModeChange"
        />
        <text class="form-caption">{{ selectedPublicationModeDescription }}</text>
      </view>
      <view class="form-field">
        <text class="form-label">{{ titleLabel }}</text>
        <input
          v-model="form.name"
          class="form-input"
          :placeholder="titlePlaceholder"
          placeholder-class="form-placeholder"
        />
      </view>
      <view class="form-grid">
        <view class="form-field">
          <text class="form-label">{{ playersLabel }}</text>
          <input
            v-model="form.playersPerTeam"
            class="form-input"
            type="number"
            :placeholder="playersPlaceholder"
            placeholder-class="form-placeholder"
          />
        </view>
        <view v-if="!isChallenge && form.publicationMode === 'offline_confirmed'" class="form-field">
          <text class="form-label">对手</text>
          <input
            v-model="form.opposing"
            class="form-input"
            placeholder="例如：XX联队"
            placeholder-class="form-placeholder"
          />
        </view>
        <view v-if="!isChallenge" class="form-field form-field-full">
          <text class="form-label">{{ colorLabel }}</text>
          <view class="color-select-grid">
            <view
              v-for="option in colorOptions"
              :key="option.value"
              :class="['color-option', form.color === option.value ? 'color-option-active' : '']"
              @tap="setColorField('color', option.value)"
            >
              <view class="color-swatch" :style="{ backgroundColor: option.value }" />
              <text class="color-option-text">{{ option.name }}</text>
            </view>
          </view>
        </view>
        <view v-if="!isChallenge" class="form-field form-field-full">
          <text class="form-label">{{ opposingColorLabel }}</text>
          <view class="color-select-grid">
            <view
              v-for="option in colorOptions"
              :key="`op-${option.value}`"
              :class="['color-option', form.opposingColor === option.value ? 'color-option-active' : '']"
              @tap="setColorField('opposingColor', option.value)"
            >
              <view class="color-swatch" :style="{ backgroundColor: option.value }" />
              <text class="color-option-text">{{ option.name }}</text>
            </view>
          </view>
        </view>
        <view v-else class="form-field">
          <text class="form-label">预计费用/人</text>
          <input
            v-model="form.feePerPerson"
            class="form-input"
            type="digit"
            placeholder="25"
            placeholder-class="form-placeholder"
          />
        </view>
      </view>
    </NeoSurface>

    <NeoSurface custom-class="form-card">
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
        <picker mode="time" :value="formatPickerTimeValue(form.holdingDate)" @change="handleMatchStartTimeChange">
          <view class="time-tile">
            <text class="time-tile-label">比赛开始时间</text>
            <view class="time-tile-value-row">
              <text :class="['time-tile-value', !form.holdingDate ? 'time-tile-value-placeholder' : '']">
                {{ displayTimeLabel(form.holdingDate) || "请选择比赛开始时间" }}
              </text>
              <text class="time-tile-arrow">›</text>
            </view>
          </view>
        </picker>

        <picker mode="time" :value="formatPickerTimeValue(form.matchEndTime)" @change="handleMatchEndTimeChange">
          <view class="time-tile">
            <text class="time-tile-label">比赛结束时间</text>
            <view class="time-tile-value-row">
              <text :class="['time-tile-value', !form.matchEndTime ? 'time-tile-value-placeholder' : '']">
                {{ displayTimeLabel(form.matchEndTime) || "请选择比赛结束时间" }}
              </text>
              <text class="time-tile-arrow">›</text>
            </view>
          </view>
        </picker>
      </view>

      <view v-if="timeValidMessage" class="form-error">
        {{ timeValidMessage }}
      </view>
    </NeoSurface>

    <NeoSurface custom-class="form-card">
      <NeoSectionHeader
        title="场地与说明"
        marker="03"
        :caption="locationCaption"
        :action-label="form.location ? '重新选择' : '选择地点'"
        @action="handleChooseLocation"
      />
      <view class="form-field">
        <input
          v-model="form.location"
          class="form-input"
          placeholder="输入球场/地址，或使用地图选择"
          placeholder-class="form-placeholder"
          @input="handleLocationInput"
        />
        <text v-if="form.locationLatitude != null && form.locationLongitude != null" class="form-hint">
          已选择地图位置，可用于签到定位。
        </text>
      </view>
      <view class="form-field">
        <text class="form-label">{{ descriptionLabel }}</text>
        <textarea
          v-model="form.description"
          class="form-textarea"
          :maxlength="120"
          :placeholder="descriptionPlaceholder"
          placeholder-class="form-placeholder"
        />
      </view>
    </NeoSurface>

    <NeoSurface v-if="showCheckIn && !isChallenge" custom-class="form-card">
      <NeoSectionHeader title="签到设置" marker="04" caption="比赛详情页只负责展示和签到，不再修改规则。" />
      <view class="checkin-switch-row">
        <text class="form-label">到场签到</text>
        <switch :checked="!!form.enableCheckIn" color="#b9f24b" @change="handleCheckInSwitchChange" />
      </view>

      <view v-if="form.enableCheckIn" class="form-grid">
        <view class="form-field">
          <text class="form-label">签到半径</text>
          <input
            v-model="form.checkInRadiusMeters"
            class="form-input"
            type="number"
            placeholder="200"
            placeholder-class="form-placeholder"
          />
        </view>
        <view class="form-field">
          <text class="form-label">提前开放</text>
          <input
            v-model="form.openMinutesBefore"
            class="form-input"
            type="number"
            placeholder="60"
            placeholder-class="form-placeholder"
          />
        </view>
        <view class="form-field">
          <text class="form-label">赛后关闭</text>
          <input
            v-model="form.closeMinutesAfter"
            class="form-input"
            type="number"
            placeholder="45"
            placeholder-class="form-placeholder"
          />
        </view>
        <view class="form-field">
          <text class="form-label">说明</text>
          <view class="form-static">单位都是分钟 / 米</view>
        </view>
      </view>
      <text v-else class="form-hint">本场不启用到场定位签到。</text>
    </NeoSurface>
  </view>
</template>

<style scoped>
.form-card {
  margin-top: 24rpx;
  padding: 6rpx 24rpx 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  box-shadow: 8rpx 8rpx 0 var(--neo-color-text);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18rpx;
}

.form-field {
  margin-top: 26rpx;
}

.form-field-full {
  grid-column: 1 / -1;
}

.form-label {
  display: block;
  margin-bottom: 10rpx;
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
}

.form-caption {
  display: block;
  margin-top: 12rpx;
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.45;
}

.form-input,
.form-textarea,
.form-static {
  width: 100%;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.form-input,
.form-static {
  display: flex;
  align-items: center;
  height: 84rpx;
  padding: 0 20rpx;
}

.form-static {
  color: var(--neo-color-text-muted);
}

.form-placeholder {
  color: var(--neo-color-text-disabled);
  font-size: 28rpx;
}

.form-textarea {
  min-height: 150rpx;
  padding: 20rpx;
  line-height: 1.5;
}

.form-hint {
  display: block;
  margin-top: 14rpx;
  padding: 16rpx 18rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-success);
  color: var(--neo-color-text);
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.5;
}

.form-error {
  margin-top: 16rpx;
  color: var(--neo-color-danger);
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.45;
}

.color-select-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.color-option {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
  min-height: 76rpx;
  padding: 0 14rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  box-sizing: border-box;
}

.color-option-active {
  border: var(--neo-border-strong);
  background: var(--neo-color-accent);
  box-shadow: 3rpx 3rpx 0 var(--neo-color-text);
}

.color-swatch {
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(17, 19, 16, 0.18);
  flex-shrink: 0;
}

.color-option-text {
  min-width: 0;
  font-size: 22rpx;
  font-weight: 800;
  color: var(--neo-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

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

.checkin-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 26rpx;
}

.checkin-switch-row .form-label {
  margin-bottom: 0;
}
</style>
