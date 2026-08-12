<script setup lang="ts">
import { computed } from "vue";
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

const textareaBoxStyle =
  "width:100%;min-height:260rpx;padding:22rpx;border-radius:24rpx;border:2rpx solid #d7ddd2;background:#f4f6f0;--wot-textarea-bg:#f4f6f0;box-shadow:inset 0 2rpx 0 rgba(255,255,255,0.74);box-sizing:border-box;";
const cardTitleStyle = "display:block;font-size:30rpx;font-weight:900;line-height:1.35;color:#111310;";
const cardCaptionStyle = "display:block;margin-top:8rpx;font-size:24rpx;font-weight:700;line-height:1.45;color:#111310;";
const formLabelStyle = "display:block;font-size:26rpx;font-weight:800;line-height:1.35;color:#111310;";

function updateField<K extends keyof MatchPublishFormModel>(key: K, value: MatchPublishFormModel[K]) {
  form.value[key] = value;
  emit("update:modelValue", form.value);
}

function setColorField(key: "color" | "opposingColor", value: string) {
  updateField(key, value);
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
  const date = parsePickerDate(baseValue || form.value.holdingDate);
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
  <view>
    <view class="create-card">
      <view class="create-card-title">基础信息</view>
      <view class="create-form-grid">
        <view v-if="!isChallenge" class="create-form-item create-form-item-full">
          <wd-text custom-class="create-form-label" color="#111310" text="比赛类型" />
          <view class="match-kind-segment">
            <view
              v-for="option in MATCH_PUBLICATION_MODE_OPTIONS"
              :key="option.value"
              :class="['match-kind-option', form.publicationMode === option.value ? 'match-kind-option-active' : '']"
              @tap="selectPublicationMode(option.value)"
            >
              <text class="match-kind-option-label">{{ option.label }}</text>
              <text class="match-kind-option-description">{{ option.description }}</text>
            </view>
          </view>
        </view>
        <view class="create-form-item create-form-item-full">
          <wd-text custom-class="create-form-label" color="#111310" :text="titleLabel" />
          <input
            v-model="form.name"
            class="create-native-input"
            :placeholder="titlePlaceholder"
            placeholder-class="create-native-placeholder"
          />
        </view>
        <view class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" :text="playersLabel" />
          <input
            v-model="form.playersPerTeam"
            class="create-native-input"
            type="number"
            :placeholder="playersPlaceholder"
            placeholder-class="create-native-placeholder"
          />
        </view>
        <view v-if="!isChallenge && form.publicationMode === 'offline_confirmed'" class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" text="对手" />
          <input
            v-model="form.opposing"
            class="create-native-input"
            placeholder="例如：XX联队"
            placeholder-class="create-native-placeholder"
          />
        </view>
        <view v-if="!isChallenge" class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" :text="colorLabel" />
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
        <view v-if="!isChallenge" class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" :text="opposingColorLabel" />
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
        <view v-else class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" text="预计费用/人" />
          <input
            v-model="form.feePerPerson"
            class="create-native-input"
            type="digit"
            placeholder="25"
            placeholder-class="create-native-placeholder"
          />
        </view>

        <view class="create-time-section create-form-item-full">
          <view class="create-time-head">
            <text class="create-time-title">比赛日期</text>
            <picker mode="date" :value="selectedDateValue" @change="handleDatePickerChange">
              <view class="create-date-picker-link">更多日期</view>
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

          <view class="create-time-grid">
            <picker mode="time" :value="formatPickerTimeValue(form.holdingDate)" @change="handleMatchStartTimeChange">
              <view class="create-time-tile">
                <text class="create-time-label">比赛开始时间</text>
                <view class="create-time-value-row">
                  <text :class="['create-time-value', !form.holdingDate ? 'create-time-value-placeholder' : '']">
                    {{ displayTimeLabel(form.holdingDate) || "请选择比赛开始时间" }}
                  </text>
                  <text class="create-time-arrow">›</text>
                </view>
              </view>
            </picker>

            <picker mode="time" :value="formatPickerTimeValue(form.matchEndTime)" @change="handleMatchEndTimeChange">
              <view class="create-time-tile">
                <text class="create-time-label">比赛结束时间</text>
                <view class="create-time-value-row">
                  <text :class="['create-time-value', !form.matchEndTime ? 'create-time-value-placeholder' : '']">
                    {{ displayTimeLabel(form.matchEndTime) || "请选择比赛结束时间" }}
                  </text>
                  <text class="create-time-arrow">›</text>
                </view>
              </view>
            </picker>
          </view>
        </view>

        <view v-if="timeValidMessage" class="create-time-error create-form-item-full">
          {{ timeValidMessage }}
        </view>
      </view>
    </view>

    <view class="create-card">
      <view class="create-card-head">
        <view>
          <wd-text :custom-style="cardTitleStyle" color="#111310" text="比赛地点" />
          <wd-text :custom-style="cardCaptionStyle" color="#111310" :text="locationCaption" />
        </view>
        <view class="create-pick-button" @tap="handleChooseLocation">
          {{ form.location ? "重新选择" : "选择地点" }}
        </view>
      </view>
      <input
        v-model="form.location"
        class="create-native-input create-location-input"
        placeholder="输入球场/地址，或使用地图选择"
        placeholder-class="create-native-placeholder"
        @input="handleLocationInput"
      />
      <view v-if="form.locationLatitude != null && form.locationLongitude != null" class="create-location-box">
        已选择地图位置，可用于签到定位。
      </view>
      <view class="create-form-item create-form-item-full create-description-field">
        <wd-text :custom-style="formLabelStyle" color="#111310" :text="descriptionLabel" />
        <wd-textarea
          v-model="form.description"
          no-border
          :maxlength="120"
          :custom-style="textareaBoxStyle"
          :placeholder="descriptionPlaceholder"
          custom-class="create-wot-textarea"
          custom-textarea-container-class="create-wot-textarea-container"
          custom-textarea-class="create-wot-textarea-inner"
        />
      </view>
    </view>

    <view v-if="showCheckIn && !isChallenge" class="create-card">
      <view class="create-card-head">
        <view>
          <wd-text custom-class="create-card-title" color="#111310" text="签到设置" />
          <wd-text custom-class="create-card-caption" color="#111310" text="比赛详情页只负责展示和签到，不再修改规则。" />
        </view>
        <switch :checked="!!form.enableCheckIn" color="#c8ff00" @change="handleCheckInSwitchChange" />
      </view>

      <view v-if="form.enableCheckIn" class="create-form-grid" style="margin-top: 20rpx;">
        <view class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" text="签到半径" />
          <input
            v-model="form.checkInRadiusMeters"
            class="create-native-input"
            type="number"
            placeholder="200"
            placeholder-class="create-native-placeholder"
          />
        </view>
        <view class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" text="提前开放" />
          <input
            v-model="form.openMinutesBefore"
            class="create-native-input"
            type="number"
            placeholder="60"
            placeholder-class="create-native-placeholder"
          />
        </view>
        <view class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" text="赛后关闭" />
          <input
            v-model="form.closeMinutesAfter"
            class="create-native-input"
            type="number"
            placeholder="45"
            placeholder-class="create-native-placeholder"
          />
        </view>
        <view class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" text="说明" />
          <view class="create-input create-input-static">单位都是分钟 / 米</view>
        </view>
      </view>
      <view v-else class="create-location-box" style="margin-top: 20rpx;">本场不启用到场定位签到。</view>
    </view>
  </view>
</template>

<style scoped>
.create-card {
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 30rpx;
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.create-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.create-card-title {
  display: block;
  font-size: 30rpx;
  color: #171814;
  font-weight: 900;
}

.create-card-caption {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #111310;
}

.create-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 22rpx;
}

.create-time-error {
  font-size: 22rpx;
  color: #d9534f;
  line-height: 1.45;
  padding-top: 4rpx;
}

.match-kind-segment {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  padding: 8rpx;
  border-radius: 24rpx;
  background: #edf1e8;
}

.match-kind-option {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  min-height: 112rpx;
  padding: 12rpx 8rpx;
  border-radius: 18rpx;
  color: #5f645c;
  text-align: center;
  box-sizing: border-box;
}

.match-kind-option-label {
  font-size: 24rpx;
  line-height: 1.2;
  font-weight: 900;
}

.match-kind-option-description {
  font-size: 18rpx;
  line-height: 1.35;
  font-weight: 700;
}

.match-kind-option-active {
  background: #c8ff00;
  color: #111310;
  box-shadow: 0 8rpx 18rpx rgba(90, 115, 0, 0.14);
}

.create-form-item {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  min-width: 0;
}

.create-form-item-full {
  grid-column: 1 / -1;
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
  border-radius: 20rpx;
  border: 2rpx solid #d7ddd2;
  background: #f4f6f0;
  box-sizing: border-box;
}

.color-option-active {
  border-color: #111310;
  background: #eef8d6;
}

.color-swatch {
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(17, 19, 16, 0.12);
  flex-shrink: 0;
}

.color-option-text {
  min-width: 0;
  font-size: 22rpx;
  font-weight: 800;
  color: #111310;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.create-form-label {
  font-size: 22rpx;
  color: #111310;
  font-weight: 700;
}

.create-input,
.create-native-input,
:deep(.create-wot-textarea-container) {
  width: 100%;
  min-height: 88rpx;
  padding: 0 22rpx;
  border-radius: 24rpx;
  border: 2rpx solid #d7ddd2;
  background: #f4f6f0;
  box-shadow: inset 0 2rpx 0 rgba(255, 255, 255, 0.74);
  color: #171814;
  font-size: 28rpx;
  box-sizing: border-box;
}

.create-input,
.create-native-input {
  display: flex;
  align-items: center;
}

.create-native-input {
  height: 88rpx;
  line-height: 88rpx;
}

.create-native-placeholder {
  color: #c7c9c5;
  font-size: 28rpx;
  line-height: 88rpx;
}

.create-input-static {
  display: flex;
  align-items: center;
  color: #60655d;
}

:deep(.create-wot-textarea-container) {
  width: 100%;
  min-height: 150rpx;
  padding: 0;
  border: none;
  box-sizing: border-box;
  background: #f4f6f0;
}

:deep(.create-wot-textarea) {
  width: 100%;
  padding: 0;
  background: #f4f6f0;
}

:deep(.create-wot-textarea-inner) {
  width: 100%;
  min-height: 150rpx;
  color: #171814;
  font-size: 28rpx;
  line-height: 1.5;
  background: transparent;
}

.create-description-field {
  width: 100%;
  margin-top: 18rpx;
}

.create-location-input {
  margin-top: 18rpx;
  width: 100%;
}

.create-time-section {
  margin-top: 2rpx;
}

.create-time-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.create-time-title {
  display: block;
  color: #111310;
  font-size: 28rpx;
  font-weight: 900;
}

.create-date-picker-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 58rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #eef2e8;
  color: #4e544b;
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
  border-radius: 30rpx;
  border: 2rpx solid #e7ebdf;
  background: #ffffff;
  box-shadow: 0 10rpx 24rpx rgba(17, 17, 17, 0.04);
  box-sizing: border-box;
}

.date-option-active {
  border-color: #c8ff00;
  background: #c8ff00;
  box-shadow: 0 18rpx 34rpx rgba(181, 214, 0, 0.24);
}

.date-option-top {
  color: #61665f;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 1.2;
}

.date-option-day {
  margin-top: 10rpx;
  color: #111310;
  font-size: 60rpx;
  font-weight: 900;
  line-height: 1;
}

.date-option-month {
  margin-top: 8rpx;
  color: #72776f;
  font-size: 20rpx;
  font-weight: 700;
}

.date-option-active .date-option-top,
.date-option-active .date-option-month {
  color: rgba(17, 19, 16, 0.72);
}

.create-time-grid {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 22rpx;
}

.create-time-tile {
  width: 100%;
  min-height: 116rpx;
  padding: 18rpx 22rpx;
  border-radius: 24rpx;
  border: 2rpx solid #d7ddd2;
  background: #f4f6f0;
  box-shadow: inset 0 2rpx 0 rgba(255, 255, 255, 0.74);
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 180rpx minmax(0, 1fr) auto;
  align-items: center;
  gap: 18rpx;
}

.create-time-label {
  display: block;
  color: #111310;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1.25;
}

.create-time-value-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.create-time-value {
  min-width: 0;
  flex: 1;
  color: #171814;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.create-time-value-placeholder {
  color: #9aa096;
}

.create-time-arrow {
  flex: 0 0 auto;
  color: #a3aaa0;
  font-size: 46rpx;
  font-weight: 500;
  line-height: 1;
}

.create-pick-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 148rpx;
  height: 72rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #131410;
  font-size: 24rpx;
  font-weight: 900;
}

.create-location-box {
  margin-top: 18rpx;
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
  background: #f4f6f0;
  font-size: 26rpx;
  color: #5f645c;
  line-height: 1.6;
}
</style>
