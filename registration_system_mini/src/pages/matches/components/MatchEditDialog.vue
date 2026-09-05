<script setup lang="ts">
import { computed } from "vue";
import NeoConfirmDialog from "@/components/neo/NeoConfirmDialog.vue";
import { pad } from "@/utils/datetime";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    opponentName: string;
    maxPlayers: string;
    /** 比赛起止时间（毫秒时间戳）；0 视为未选择。 */
    startTime: number;
    endTime: number;
    submitting: boolean;
    /** 是否显示比赛类型切换（仅线上约队且尚无球队接招时开放）。 */
    showTypeChange?: boolean;
    /** 可选类型列表；typeValue 为当前选中值。 */
    typeOptions?: Array<{ value: string; label: string }>;
    typeValue?: string;
  }>(),
  { showTypeChange: false, typeOptions: () => [], typeValue: "" },
);

const emit = defineEmits<{
  (event: "close"): void;
  (event: "update:opponentName", value: string): void;
  (event: "update:maxPlayers", value: string): void;
  (event: "update:startTime", value: number): void;
  (event: "update:endTime", value: number): void;
  (event: "update:typeValue", value: string): void;
  (event: "submit"): void;
}>();

const typeLabels = computed(() => props.typeOptions.map((option) => option.label));
const selectedTypeIndex = computed(() =>
  Math.max(0, props.typeOptions.findIndex((option) => option.value === props.typeValue)),
);

function handleTypeChange(event: Event) {
  const detail = event as Event & { detail?: { value?: number | string } };
  const index = Number(detail.detail?.value);
  const option = props.typeOptions[index];
  if (option) emit("update:typeValue", option.value);
}

function safeDate(value: number) {
  const date = value ? new Date(value) : new Date();
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function pickerDateValue(value: number) {
  const date = safeDate(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pickerTimeValue(value: number) {
  const date = safeDate(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 日期 picker 只改年月日，保留已选钟点。 */
function mergeDate(baseValue: number, pickerValue: string) {
  const date = safeDate(baseValue);
  const [year, month, day] = pickerValue.split("-").map((item) => Number(item));
  date.setFullYear(year, (month || 1) - 1, day || 1);
  date.setSeconds(0, 0);
  return date.getTime();
}

/** 时间 picker 只改钟点，保留已选日期。 */
function mergeTime(baseValue: number, pickerValue: string) {
  const date = safeDate(baseValue);
  const [hour, minute] = pickerValue.split(":").map((item) => Number(item));
  date.setHours(hour || 0, minute || 0, 0, 0);
  return date.getTime();
}

function pickerChangeValue(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  return detail.detail?.value ?? "";
}
</script>

<template>
  <!-- 修改比赛：对手名称 + 报名人数上限 + 比赛起止时间（借对话框默认插槽承载轻量表单）。 -->
  <NeoConfirmDialog
    :visible="visible"
    title="修改比赛"
    :message="showTypeChange ? '可修改比赛类型、对手名称、报名人数上限与比赛时间；切换类型会自动拒绝待处理的球队申请。' : '可修改对手名称、报名人数上限与比赛时间。'"
    primary-text="保存修改"
    secondary-text="取消"
    :loading="submitting"
    :primary-disabled="submitting || !maxPlayers.trim() || Number(maxPlayers) <= 0"
    @primary="emit('submit')"
    @secondary="emit('close')"
    @close="emit('close')"
  >
    <view v-if="showTypeChange" class="match-edit-field">
      <text class="match-edit-label">比赛类型</text>
      <picker mode="selector" :range="typeLabels" :value="selectedTypeIndex" @change="handleTypeChange">
        <view class="match-edit-input match-edit-type-value">
          <text>{{ typeOptions[selectedTypeIndex]?.label || "选择比赛类型" }}</text>
          <text class="match-edit-type-arrow">›</text>
        </view>
      </picker>
    </view>
    <view class="match-edit-field">
      <text class="match-edit-label">对手名称</text>
      <input
        class="match-edit-input"
        :value="opponentName"
        placeholder="输入对手球队名称（留空表示清除）"
        :disabled="submitting"
        @input="emit('update:opponentName', ($event as any).detail.value)"
      />
    </view>
    <view class="match-edit-field">
      <text class="match-edit-label">报名人数上限</text>
      <input
        class="match-edit-input"
        type="number"
        :value="maxPlayers"
        placeholder="本队报名组的人数上限"
        :disabled="submitting"
        @input="emit('update:maxPlayers', ($event as any).detail.value)"
      />
    </view>
    <view class="match-edit-field">
      <text class="match-edit-label">比赛开始时间</text>
      <view class="match-edit-datetime">
        <picker mode="date" :value="pickerDateValue(startTime)" @change="emit('update:startTime', mergeDate(startTime, pickerChangeValue($event)))">
          <view class="match-edit-chip">{{ pickerDateValue(startTime) }}</view>
        </picker>
        <picker mode="time" :value="pickerTimeValue(startTime)" @change="emit('update:startTime', mergeTime(startTime, pickerChangeValue($event)))">
          <view class="match-edit-chip">{{ pickerTimeValue(startTime) }}</view>
        </picker>
      </view>
    </view>
    <view class="match-edit-field">
      <text class="match-edit-label">比赛结束时间</text>
      <view class="match-edit-datetime">
        <picker mode="date" :value="pickerDateValue(endTime)" @change="emit('update:endTime', mergeDate(endTime, pickerChangeValue($event)))">
          <view class="match-edit-chip">{{ pickerDateValue(endTime) }}</view>
        </picker>
        <picker mode="time" :value="pickerTimeValue(endTime)" @change="emit('update:endTime', mergeTime(endTime, pickerChangeValue($event)))">
          <view class="match-edit-chip">{{ pickerTimeValue(endTime) }}</view>
        </picker>
      </view>
    </view>
  </NeoConfirmDialog>
</template>

<style scoped>
.match-edit-field {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 18rpx;
}

.match-edit-label {
  font-size: 25rpx;
  font-weight: 800;
  color: var(--neo-color-text-muted);
}

.match-edit-input {
  box-sizing: border-box;
  width: 100%;
  height: 84rpx;
  padding: 0 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-page);
  font-size: 28rpx;
  color: var(--neo-color-text);
}

/* 起止时间：日期 + 钟点两段选择，各占一半宽度。 */
.match-edit-datetime {
  display: flex;
  gap: 14rpx;
  width: 100%;
}

.match-edit-datetime picker {
  flex: 1;
  min-width: 0;
}

.match-edit-chip {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 84rpx;
  padding: 0 12rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-page);
  font-size: 28rpx;
  font-weight: 800;
  color: var(--neo-color-text);
  white-space: nowrap;
  overflow: hidden;
}

/* 类型选择：外观与输入框一致，右侧箭头提示可点开 selector。 */
.match-edit-type-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.match-edit-type-arrow {
  flex-shrink: 0;
  color: var(--neo-color-text-muted);
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1;
}
</style>
