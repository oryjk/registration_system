<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import { computed } from "vue";
import SectionHeader from "@/components/ui/SectionHeader.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import type { SegmentOption } from "@/components/ui/SegmentedControl.vue";
import MatchScheduleFields from "@/components/MatchScheduleFields.vue";
import TeamColorPicker from "./TeamColorPicker.vue";
import { defaultMatchFeeType } from "./matchPublishFormModel";
import type { MatchPublishFormModel } from "./matchPublishFormModel";
import type { AppMatchPublicationMode } from "@/types/match";
import { MATCH_PUBLICATION_MODE_OPTIONS } from "@/utils/matchPublicationMode";

const { accentHex } = useAccentTheme();

const props = withDefaults(
  defineProps<{
    modelValue: MatchPublishFormModel;
    mode?: "match" | "challenge";
    timeValidMessage?: string;
    showCheckIn?: boolean;
    allowedPublicationModes?: AppMatchPublicationMode[];
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

const selectedFeeType = computed(() => form.value.feeType ?? defaultMatchFeeType(form.value.publicationMode));
const feeOptions: SegmentOption[] = [
 { label: "线下 AA", value: "offline_aa" }, { label: "队费扣除", value: "team_fund" },
 { label: "免费", value: "free" }, { label: "具体金额", value: "fixed_amount" },
];
function handleFeeTypeChange(value: string) { updateField("feeType", value as NonNullable<MatchPublishFormModel["feeType"]>); }
const isChallenge = computed(() => props.mode === "challenge");
const titleLabel = computed(() => (isChallenge.value ? "约队标题" : "比赛名称"));
const titlePlaceholder = computed(() => (isChallenge.value ? "例如：周五晚 8 人制约队" : "例如：周五晚友谊赛"));
const playersLabel = computed(() => (isChallenge.value ? "人数" : "比赛人制"));
const playersPlaceholder = computed(() => (isChallenge.value ? "8" : "例如：8"));
const capacityPlaceholder = computed(() => (isChallenge.value ? "" : "默认人制 + 2"));
const colorLabel = computed(() => (isChallenge.value ? "主队球服" : "本队球服"));
const opposingColorLabel = computed(() => (isChallenge.value ? "对手球服" : "对方球服"));
const descriptionLabel = computed(() => (isChallenge.value ? "备注" : "说明"));
const descriptionPlaceholder = computed(() =>
  isChallenge.value ? "例如：强度中高，守时优先" : "可选补充场地、人数、集合要求",
);
const locationCaption = computed(() =>
  isChallenge.value ? "可直接输入文字地址，也可以使用地图选择场地。" : "可直接输入文字地址；启用签到时请用地图选择经纬度。",
);

const publicationModeOptions = computed<SegmentOption[]>(() =>
  MATCH_PUBLICATION_MODE_OPTIONS.filter(option => !props.allowedPublicationModes || props.allowedPublicationModes.includes(option.value)).map((option) => ({ label: option.label, value: option.value })),
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
  updateField("feeType", defaultMatchFeeType(mode));
  if (mode !== "offline_confirmed") {
    updateField("opposing", "");
  }
}

function handleCheckInSwitchChange(event: Event) {
  const detail = event as Event & { detail?: { value?: boolean } };
  updateField("enableCheckIn", !!detail.detail?.value);
}

function handleOpenVenuePicker() {
  emit("openVenuePicker");
}

</script>

<template>
  <view class="publish-form">
    <AppSurface custom-class="form-card">
      <SectionHeader title="基础信息" caption="填写比赛名称、对手和报名人数" />
      <view v-if="!isChallenge" class="form-field">
        <text class="form-label">比赛类型</text>
        <SegmentedControl
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
      <view v-if="!isChallenge && form.publicationMode === 'offline_confirmed'" class="form-field">
        <text class="form-label">对手</text>
        <input
          v-model="form.opposing"
          class="form-input"
          placeholder="例如：XX联队"
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
          <text class="form-label">报名上限（人）</text>
          <input
            v-model="form.hostCapacityLimit"
            class="form-input"
            type="number"
            :placeholder="capacityPlaceholder"
            placeholder-class="form-placeholder"
          />
        </view>
      </view>
        <view class="form-field">
          <text class="form-label">预计费用</text>
          <SegmentedControl :model-value="selectedFeeType" :options="feeOptions" @change="handleFeeTypeChange" />
          <input v-if="selectedFeeType === 'fixed_amount'" v-model="form.feePerPerson" class="form-input" type="digit" placeholder="填写人均金额（元）" placeholder-class="form-placeholder" />
          <text v-if="selectedFeeType === 'team_fund'" class="form-caption">费用由队费承担，当前仅作说明，不会自动扣款。</text>
          <text v-else-if="selectedFeeType === 'offline_aa'" class="form-caption">费用由参与者线下分摊。</text>
        </view>
      <view v-if="!isChallenge" class="form-kit-section">
        <TeamColorPicker
          :label="colorLabel"
          :model-value="form.color"
          @update:model-value="updateField('color', $event)"
        />
        <TeamColorPicker
          :label="opposingColorLabel"
          :model-value="form.opposingColor"
          @update:model-value="updateField('opposingColor', $event)"
        />
      </view>
    </AppSurface>

    <AppSurface custom-class="form-card">
      <MatchScheduleFields
        :holding-date="form.holdingDate"
        :match-end-time="form.matchEndTime"
        :time-valid-message="timeValidMessage"
        @update:holding-date="updateField('holdingDate', $event)"
        @update:match-end-time="updateField('matchEndTime', $event)"
      />
      <view class="form-section-divider" />
      <SectionHeader
        title="比赛地点"
        :caption="locationCaption"
      />
      <view class="form-field">
        <!-- 点击打开场地选择弹层（常用场地/手动输入/地图选点），不再直接键入。 -->
        <view class="venue-entry" hover-class="venue-entry--pressed" @tap="handleOpenVenuePicker">
          <text :class="['venue-entry__value', form.location ? '' : 'venue-entry__placeholder']">
            {{ form.location || "点击选择球场/地址" }}
          </text>
          <view class="venue-entry__icon" aria-hidden="true">
            <wd-icon name="location" size="32rpx" color="var(--ui-color-text-muted)" />
          </view>
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
    </AppSurface>

    <AppSurface v-if="showCheckIn && !isChallenge" custom-class="form-card">
      <SectionHeader title="签到设置" caption="设置到场签到方式与有效范围" />
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
    </AppSurface>
  </view>
</template>

<style scoped>
.publish-form { display: flex; flex-direction: column; gap: 20rpx; margin-top: 20rpx; }
.form-card {
  padding: 6rpx 24rpx 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  box-shadow: var(--ui-shadow-card);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18rpx;
}

.form-field {
  margin-top: 26rpx;
}

.form-kit-section { margin-top: 24rpx; padding-top: 2rpx; border-top: var(--ui-border-default); }
.form-section-divider { margin: 28rpx 0; border-top: var(--ui-border-default); }

.form-label {
  display: block;
  margin-bottom: 10rpx;
  color: var(--ui-color-text);
  font-size: 24rpx;
  font-weight: 600;
}

.form-caption {
  display: block;
  margin-top: 12rpx;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  font-weight: 400;
  line-height: 1.45;
}

.form-input,
.form-textarea,
.form-static {
  width: 100%;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: 500;
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
  color: var(--ui-color-text-muted);
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
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  box-sizing: border-box;
}

.venue-entry--pressed {
  background: var(--ui-color-surface);
}

.venue-entry__value {
  flex: 1;
  min-width: 0;
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.venue-entry__placeholder {
  color: var(--ui-color-text-disabled);
}

.venue-entry__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40rpx;
  height: 40rpx;
}

.form-placeholder {
  color: var(--ui-color-text-disabled);
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
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-success);
  color: var(--ui-color-text);
  font-size: 22rpx;
  font-weight: 500;
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
