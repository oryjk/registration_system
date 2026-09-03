<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import { computed } from "vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSegmentedControl from "@/components/neo/NeoSegmentedControl.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import type { NeoSegmentOption } from "@/components/neo/NeoSegmentedControl.vue";
import MatchScheduleFields from "@/components/MatchScheduleFields.vue";
import TeamColorPicker from "./TeamColorPicker.vue";
import type { MatchPublishFormModel } from "./matchPublishForm";
import type { AppMatchPublicationMode } from "@/types/match";
import { MATCH_PUBLICATION_MODE_OPTIONS } from "@/utils/matchPublicationMode";

const { accentHex } = useAccentTheme();

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
  (event: "openVenuePicker"): void;
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
const capacityPlaceholder = computed(() => (isChallenge.value ? "" : "例如：10（默认人制+2）"));
const colorLabel = computed(() => (isChallenge.value ? "主队球服" : "本队球服"));
const opposingColorLabel = computed(() => (isChallenge.value ? "对手球服" : "对方球服"));
const descriptionLabel = computed(() => (isChallenge.value ? "备注" : "说明"));
const descriptionPlaceholder = computed(() =>
  isChallenge.value ? "例如：强度中高，守时优先" : "可选补充场地、人数、集合要求",
);
const locationCaption = computed(() =>
  isChallenge.value ? "可直接输入文字地址，也可以使用地图选择场地。" : "可直接输入文字地址；启用签到时请用地图选择经纬度。",
);

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

function handlePublicationModeChange(value: string) {
  const mode = value as AppMatchPublicationMode;
  updateField("publicationMode", mode);
  if (mode !== "offline_confirmed") {
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

function handleOpenVenuePicker() {
  emit("openVenuePicker");
}

function handleChooseLocation() {
  emit("chooseLocation");
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
        <view v-if="!isChallenge" class="form-field">
          <text class="form-label">报名人数上限</text>
          <input
            v-model="form.hostCapacityLimit"
            class="form-input"
            type="number"
            :placeholder="capacityPlaceholder"
            placeholder-class="form-placeholder"
          />
          <text class="form-caption">本队最多可报名人数；不填默认为人制 + 2</text>
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
        <TeamColorPicker
          v-if="!isChallenge"
          class="form-field-full"
          :label="colorLabel"
          :model-value="form.color"
          @update:model-value="updateField('color', $event)"
        />
        <TeamColorPicker
          v-if="!isChallenge"
          class="form-field-full"
          :label="opposingColorLabel"
          :model-value="form.opposingColor"
          @update:model-value="updateField('opposingColor', $event)"
        />
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
      <MatchScheduleFields
        :holding-date="form.holdingDate"
        :match-end-time="form.matchEndTime"
        :time-valid-message="timeValidMessage"
        @update:holding-date="updateField('holdingDate', $event)"
        @update:match-end-time="updateField('matchEndTime', $event)"
      />
    </NeoSurface>

    <NeoSurface custom-class="form-card">
      <NeoSectionHeader
        title="场地与说明"
        marker="03"
        :caption="locationCaption"
        :action-label="form.location ? '重新选择' : '选择地点'"
        @action="handleOpenVenuePicker"
      />
      <view class="form-field">
        <!-- 点击打开场地选择弹层（常用场地/手动输入/地图选点），不再直接键入。 -->
        <view class="venue-entry" hover-class="venue-entry--pressed" @tap="handleOpenVenuePicker">
          <text :class="['venue-entry__value', form.location ? '' : 'venue-entry__placeholder']">
            {{ form.location || "点击选择球场/地址" }}
          </text>
          <text class="venue-entry__arrow">›</text>
        </view>
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
          :adjust-position="true"
          :cursor-spacing="120"
          :show-confirm-bar="false"
        />
      </view>
    </NeoSurface>

    <NeoSurface v-if="showCheckIn && !isChallenge" custom-class="form-card">
      <NeoSectionHeader title="签到设置" marker="04" caption="比赛详情页只负责展示和签到，不再修改规则。" />
      <view class="checkin-switch-row">
        <text class="form-label">到场签到</text>
        <switch :checked="!!form.enableCheckIn" :color="accentHex" @change="handleCheckInSwitchChange" />
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

/* 场地选择入口：与 form-input 同规格的点击框，点击打开场地选择弹层。 */
.venue-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  width: 100%;
  min-height: 84rpx;
  padding: 0 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  box-sizing: border-box;
}

.venue-entry--pressed {
  background: var(--neo-color-surface);
}

.venue-entry__value {
  flex: 1;
  min-width: 0;
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.venue-entry__placeholder {
  color: var(--neo-color-text-disabled);
}

.venue-entry__arrow {
  flex-shrink: 0;
  color: var(--neo-color-text-muted);
  font-size: 36rpx;
  font-weight: 900;
  line-height: 1;
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
