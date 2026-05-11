<script setup lang="ts">
import { computed } from "vue";
import type { MatchPublishFormModel } from "./matchPublishForm";

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
const descriptionLabel = computed(() => (isChallenge.value ? "备注" : "说明"));
const descriptionPlaceholder = computed(() =>
  isChallenge.value ? "例如：强度中高，守时优先" : "可选补充场地、人数、集合要求",
);
const locationCaption = computed(() =>
  isChallenge.value ? "可直接输入文字地址，也可以使用地图选择场地。" : "可直接输入文字地址；启用签到时请用地图选择经纬度。",
);
const secondTimeLabel = computed(() => (isChallenge.value ? "开始时间" : "报名开始"));
const thirdTimeLabel = computed(() => (isChallenge.value ? "结束时间" : "报名截止"));
const secondTimeTitle = computed(() => (isChallenge.value ? "选择开始时间" : "选择报名开始时间"));
const thirdTimeTitle = computed(() => (isChallenge.value ? "选择结束时间" : "选择报名截止时间"));
const secondTimePlaceholder = computed(() => (isChallenge.value ? "请选择开始时间" : "请选择报名开始时间"));
const thirdTimePlaceholder = computed(() => (isChallenge.value ? "请选择结束时间" : "请选择报名截止时间"));

const fieldBoxStyle =
  "width:100%;height:88rpx;min-height:88rpx;padding:0 22rpx;border-radius:24rpx;border:2rpx solid #d7ddd2;background:#f4f6f0;box-shadow:inset 0 2rpx 0 rgba(255,255,255,0.74);box-sizing:border-box;";
const textareaBoxStyle =
  "width:100%;min-height:260rpx;padding:22rpx;border-radius:24rpx;border:2rpx solid #d7ddd2;background:#f4f6f0;--wot-textarea-bg:#f4f6f0;box-shadow:inset 0 2rpx 0 rgba(255,255,255,0.74);box-sizing:border-box;";
const datetimePickerStyle = "width:100%;display:block;";
const cardTitleStyle = "display:block;font-size:30rpx;font-weight:900;line-height:1.35;color:#111310;";
const cardCaptionStyle = "display:block;margin-top:8rpx;font-size:24rpx;font-weight:700;line-height:1.45;color:#111310;";
const formLabelStyle = "display:block;font-size:26rpx;font-weight:800;line-height:1.35;color:#111310;";

function updateField<K extends keyof MatchPublishFormModel>(key: K, value: MatchPublishFormModel[K]) {
  form.value[key] = value;
  emit("update:modelValue", form.value);
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

function defaultDateTimeValue(offsetHours = 0) {
  const date = new Date();
  date.setHours(date.getHours() + offsetHours);
  return date.getTime();
}

function displayDateTime(items: Array<{ value: string | number }>) {
  if (!items.length) return "";
  const [year, month, day, hour, minute] = items.map((item) => Number(item.value));
  const date = new Date(year, month - 1, day, hour, minute);
  return `${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTimeColumn(type: string, value: string) {
  const unitMap: Record<string, string> = {
    year: "年",
    month: "月",
    date: "日",
    hour: "时",
    minute: "分",
    second: "秒",
  };
  return `${value}${unitMap[type] ?? ""}`;
}
</script>

<template>
  <view>
    <view class="create-card">
      <view class="create-card-title">基础信息</view>
      <view class="create-form-grid">
        <view class="create-form-item create-form-item-full">
          <wd-text custom-class="create-form-label" color="#111310" :text="titleLabel" />
          <wd-input
            v-model="form.name"
            no-border
            clearable
            :placeholder="titlePlaceholder"
            :custom-style="fieldBoxStyle"
            custom-class="create-wot-input"
            custom-input-class="create-wot-input-inner"
          />
        </view>
        <view class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" :text="playersLabel" />
          <wd-input
            v-model="form.playersPerTeam"
            no-border
            type="number"
            :placeholder="playersPlaceholder"
            :custom-style="fieldBoxStyle"
            custom-class="create-wot-input"
            custom-input-class="create-wot-input-inner"
          />
        </view>
        <view v-if="!isChallenge" class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" text="对手" />
          <wd-input
            v-model="form.opposing"
            no-border
            clearable
            placeholder="例如：XX联队"
            :custom-style="fieldBoxStyle"
            custom-class="create-wot-input"
            custom-input-class="create-wot-input-inner"
          />
        </view>
        <view v-else class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" text="预计费用/人" />
          <wd-input
            v-model="form.feePerPerson"
            no-border
            type="digit"
            placeholder="25"
            :custom-style="fieldBoxStyle"
            custom-class="create-wot-input"
            custom-input-class="create-wot-input-inner"
          />
        </view>
        <view class="create-form-item create-form-item-full">
          <wd-text custom-class="create-form-label" color="#111310" text="比赛时间" />
          <wd-datetime-picker
            v-model="form.holdingDate"
            type="datetime"
            title="选择比赛时间"
            placeholder="请选择比赛时间"
            confirm-button-text="确定"
            cancel-button-text="取消"
            :default-value="defaultDateTimeValue()"
            :display-format="displayDateTime"
            :formatter="formatDateTimeColumn"
            :custom-style="datetimePickerStyle"
            custom-class="create-wot-datetime"
            custom-cell-class="create-wot-datetime-cell"
            custom-value-class="create-wot-datetime-value"
          />
        </view>
        <view class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" :text="secondTimeLabel" />
          <wd-datetime-picker
            v-model="form.startTime"
            type="datetime"
            :title="secondTimeTitle"
            :placeholder="secondTimePlaceholder"
            confirm-button-text="确定"
            cancel-button-text="取消"
            :display-format="displayDateTime"
            :formatter="formatDateTimeColumn"
            :custom-style="datetimePickerStyle"
            custom-class="create-wot-datetime"
            custom-cell-class="create-wot-datetime-cell"
            custom-value-class="create-wot-datetime-value"
          />
        </view>
        <view class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" :text="thirdTimeLabel" />
          <wd-datetime-picker
            v-model="form.endTime"
            type="datetime"
            :title="thirdTimeTitle"
            :placeholder="thirdTimePlaceholder"
            confirm-button-text="确定"
            cancel-button-text="取消"
            :display-format="displayDateTime"
            :formatter="formatDateTimeColumn"
            :custom-style="datetimePickerStyle"
            custom-class="create-wot-datetime"
            custom-cell-class="create-wot-datetime-cell"
            custom-value-class="create-wot-datetime-value"
          />
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
      <wd-input
        v-model="form.location"
        no-border
        clearable
        :custom-style="fieldBoxStyle"
        custom-class="create-wot-input create-location-input"
        custom-input-class="create-wot-input-inner"
        placeholder="输入球场/地址，或使用地图选择"
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
          maxlength="120"
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
          <wd-input
            v-model="form.checkInRadiusMeters"
            no-border
            type="number"
            placeholder="200"
            :custom-style="fieldBoxStyle"
            custom-class="create-wot-input"
            custom-input-class="create-wot-input-inner"
          />
        </view>
        <view class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" text="提前开放" />
          <wd-input
            v-model="form.openMinutesBefore"
            no-border
            type="number"
            placeholder="60"
            :custom-style="fieldBoxStyle"
            custom-class="create-wot-input"
            custom-input-class="create-wot-input-inner"
          />
        </view>
        <view class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" text="赛后关闭" />
          <wd-input
            v-model="form.closeMinutesAfter"
            no-border
            type="number"
            placeholder="45"
            :custom-style="fieldBoxStyle"
            custom-class="create-wot-input"
            custom-input-class="create-wot-input-inner"
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

.create-form-item {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  min-width: 0;
}

.create-form-item-full {
  grid-column: 1 / -1;
}

.create-form-label {
  font-size: 22rpx;
  color: #111310;
  font-weight: 700;
}

.create-input,
:deep(.create-wot-input),
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

.create-input {
  display: flex;
  align-items: center;
}

:deep(.create-wot-input) {
  display: flex;
  align-items: center;
}

:deep(.create-wot-input-inner) {
  width: 100%;
  height: 88rpx;
  min-height: 88rpx;
  line-height: 88rpx;
  color: #171814;
  font-size: 28rpx;
  background: transparent;
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

.create-wot-datetime {
  width: 100%;
  display: block;
}

:deep(.create-wot-datetime-cell) {
  width: 100%;
  min-height: 88rpx;
  padding: 0 22rpx;
  border-radius: 24rpx;
  border: 2rpx solid #d7ddd2;
  background: #f4f6f0;
  box-shadow: inset 0 2rpx 0 rgba(255, 255, 255, 0.74);
  color: #171814;
  box-sizing: border-box;
}

:deep(.create-wot-datetime-value) {
  color: #171814;
  font-size: 28rpx;
  font-weight: 800;
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
