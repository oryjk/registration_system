<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import { createActivity } from "@/api/activity";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";

const { currentTeam, ensureSessionReady } = useTeamContext();
const navMetrics = getCustomNavMetrics();

const submitting = ref(false);
const form = reactive({
  name: "",
  location: "",
  locationLatitude: null as number | null,
  locationLongitude: null as number | null,
  holdingDate: 0,
  startTime: 0,
  endTime: 0,
  opposing: "",
  description: "",
  playersPerTeam: "" as string | number,
  enableCheckIn: false,
  checkInRadiusMeters: 200,
  openMinutesBefore: 60,
  closeMinutesAfter: 45,
});

watch(
  () => form.holdingDate,
  (val) => {
    if (val > 0 && !form.startTime && !form.endTime) {
      form.startTime = val - 2 * 24 * 60 * 60 * 1000;
      form.endTime = val - 60 * 60 * 1000;
    }
  },
);

const timeValid = computed(() => {
  if (!form.startTime || !form.endTime || !form.holdingDate) return false;
  if (form.startTime >= form.endTime) return false;
  if (form.startTime >= form.holdingDate) return false;
  if (form.endTime >= form.holdingDate) return false;
  return true;
});

const timeValidMessage = computed(() => {
  if (!form.startTime || !form.endTime || !form.holdingDate) return "请选择报名时间和比赛时间";
  if (form.startTime >= form.endTime) return "报名开始时间应早于报名截止时间";
  if (form.startTime >= form.holdingDate) return "报名开始时间应早于比赛时间";
  if (form.endTime >= form.holdingDate) return "报名截止时间应早于比赛时间";
  return "";
});

const canSubmit = computed(
  () =>
    !!currentTeam.value &&
    currentTeam.value.canManageTeam &&
    !!form.name.trim() &&
    !!form.location.trim() &&
    (!form.enableCheckIn || (form.locationLatitude != null && form.locationLongitude != null)) &&
    form.holdingDate > 0 &&
    form.startTime > 0 &&
    form.endTime > 0 &&
    timeValid.value,
);
const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));
const fieldBoxStyle =
  "width:100%;min-height:88rpx;padding:0 22rpx;border-radius:24rpx;border:2rpx solid #d7ddd2;background:#f4f6f0;box-shadow:inset 0 2rpx 0 rgba(255,255,255,0.74);box-sizing:border-box;";
const textareaBoxStyle =
  "width:100%;min-height:260rpx;padding:22rpx;border-radius:24rpx;border:2rpx solid #d7ddd2;background:#f4f6f0;--wot-textarea-bg:#f4f6f0;box-shadow:inset 0 2rpx 0 rgba(255,255,255,0.74);box-sizing:border-box;";
const datetimePickerStyle = "width:100%;display:block;";
const cardTitleStyle = "display:block;font-size:30rpx;font-weight:900;line-height:1.35;color:#111310;";
const cardCaptionStyle = "display:block;margin-top:8rpx;font-size:24rpx;font-weight:700;line-height:1.45;color:#111310;";
const formLabelStyle = "display:block;font-size:26rpx;font-weight:800;line-height:1.35;color:#111310;";

function handleCheckInSwitchChange(event: Event) {
  const detail = event as Event & { detail?: { value?: boolean } };
  form.enableCheckIn = !!detail.detail?.value;
}

function handleLocationInput() {
  form.locationLatitude = null;
  form.locationLongitude = null;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function defaultDateTimeValue(offsetHours = 0) {
  const date = new Date();
  date.setHours(date.getHours() + offsetHours);
  return date.getTime();
}

function toBackendDateTime(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
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

function initDefaultForm() {
  form.name = "";
  form.location = "";
  form.locationLatitude = null;
  form.locationLongitude = null;
  form.holdingDate = 0;
  form.startTime = 0;
  form.endTime = 0;
  form.opposing = "";
  form.description = "";
  form.playersPerTeam = "";
  form.enableCheckIn = false;
  form.checkInRadiusMeters = 200;
  form.openMinutesBefore = 60;
  form.closeMinutesAfter = 45;
}

async function handleChooseLocation() {
  try {
    const location = await uni.chooseLocation({});
    form.location = location.name || location.address || "";
    form.locationLatitude = location.latitude;
    form.locationLongitude = location.longitude;
  } catch (error) {
    uni.showToast({
      title: "未选择地点",
      icon: "none",
    });
  }
}

async function handleSubmit() {
  if (!currentTeam.value || !currentTeam.value.canManageTeam) {
    uni.showToast({
      title: "只有队长或领队可以创建比赛",
      icon: "none",
    });
    return;
  }

  if (!canSubmit.value || submitting.value) {
    uni.showToast({
      title: form.enableCheckIn && (form.locationLatitude == null || form.locationLongitude == null) ? "启用签到需选择地图位置" : !timeValid.value ? timeValidMessage.value : "请先补全比赛信息",
      icon: "none",
    });
    return;
  }

  submitting.value = true;
  try {
    const activity = await createActivity({
      name: form.name.trim(),
      location: form.location.trim(),
      location_latitude: form.locationLatitude ?? undefined,
      location_longitude: form.locationLongitude ?? undefined,
      holding_date: toBackendDateTime(form.holdingDate),
      start_time: toBackendDateTime(form.startTime),
      end_time: toBackendDateTime(form.endTime),
      opposing: form.opposing.trim() || undefined,
      description: form.description.trim() || undefined,
      home_team_id: currentTeam.value.id,
      players_per_team: Number(form.playersPerTeam) || undefined,
      team_checkin_configs: form.enableCheckIn
        ? [
            {
              team_id: currentTeam.value.id,
              enabled: true,
              radius_meters: Number(form.checkInRadiusMeters),
              open_minutes_before: Number(form.openMinutesBefore),
              close_minutes_after: Number(form.closeMinutesAfter),
            },
          ]
        : [],
    });

    uni.showToast({
      title: "比赛已创建",
      icon: "none",
    });
    uni.redirectTo({
      url: `/pages/matches/detail?id=${activity.id}`,
    });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "创建比赛失败",
      icon: "none",
    });
  } finally {
    submitting.value = false;
  }
}

onShow(async () => {
  await ensureSessionReady();
  if (!form.holdingDate) {
    initDefaultForm();
  }
});
</script>

<template>
  <view class="create-match-page" :style="pageStyle">
    <AppTabHeader title="创建比赛" showBack />

    <view class="create-hero">
      <view>
        <wd-text custom-class="create-hero-tag" color="#111310" text="创建比赛" />
        <wd-text custom-class="create-hero-title" color="#111310" :text="currentTeam?.name || '当前球队'" />
        <wd-text custom-class="create-hero-copy" color="#111310" text="创建后默认归属当前球队，并自动回填本队成员报名。" />
      </view>
    </view>

    <view class="create-card">
      <view class="create-card-title">基础信息</view>
      <view class="create-form-grid">
        <view class="create-form-item create-form-item-full">
          <wd-text custom-class="create-form-label" color="#111310" text="比赛名称" />
          <wd-input
            v-model="form.name"
            no-border
            clearable
            placeholder="例如：周五晚友谊赛"
            :custom-style="fieldBoxStyle"
            custom-class="create-wot-input"
            custom-input-class="create-wot-input-inner"
          />
        </view>
        <view class="create-form-item">
          <wd-text custom-class="create-form-label" color="#111310" text="比赛人制" />
          <wd-input
            v-model="form.playersPerTeam"
            no-border
            type="number"
            placeholder="例如：8"
            :custom-style="fieldBoxStyle"
            custom-class="create-wot-input"
            custom-input-class="create-wot-input-inner"
          />
        </view>
        <view class="create-form-item">
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
          <wd-text custom-class="create-form-label" color="#111310" text="报名开始" />
          <wd-datetime-picker
            v-model="form.startTime"
            type="datetime"
            title="选择报名开始时间"
            placeholder="请选择报名开始时间"
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
          <wd-text custom-class="create-form-label" color="#111310" text="报名截止" />
          <wd-datetime-picker
            v-model="form.endTime"
            type="datetime"
            title="选择报名截止时间"
            placeholder="请选择报名截止时间"
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
          <wd-text :custom-style="cardCaptionStyle" color="#111310" text="可直接输入文字地址；启用签到时请用地图选择经纬度。" />
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
        <wd-text :custom-style="formLabelStyle" color="#111310" text="说明" />
        <wd-textarea
          v-model="form.description"
          no-border
          maxlength="120"
          :custom-style="textareaBoxStyle"
          placeholder="可选补充场地、人数、集合要求"
          custom-class="create-wot-textarea"
          custom-textarea-container-class="create-wot-textarea-container"
          custom-textarea-class="create-wot-textarea-inner"
        />
      </view>
    </view>

    <view class="create-card">
      <view class="create-card-head">
        <view>
          <wd-text custom-class="create-card-title" color="#111310" text="签到设置" />
          <wd-text custom-class="create-card-caption" color="#111310" text="比赛详情页只负责展示和签到，不再修改规则。" />
        </view>
        <switch :checked="form.enableCheckIn" color="#c8ff00" @change="handleCheckInSwitchChange" />
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

    <view class="create-submit-row">
      <view :class="['create-submit-button', !canSubmit ? 'create-submit-button-disabled' : '']" @tap="canSubmit ? handleSubmit() : null">
        {{ submitting ? "创建中..." : "创建比赛" }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.create-match-page {
  min-height: 100vh;
  padding: 30rpx 28rpx 100rpx;
  background:
    radial-gradient(circle at top right, rgba(200, 255, 0, 0.15), transparent 24%),
    linear-gradient(180deg, #fbfcf7 0%, #f3f5ee 100%);
  box-sizing: border-box;
}

.create-card {
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.create-hero {
  padding: 28rpx;
  border-radius: 34rpx;
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.create-hero-tag {
  display: inline-flex;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #eef8d6;
  color: #526a00;
  font-size: 22rpx;
  font-weight: 900;
}

.create-hero-title {
  display: block;
  margin-top: 14rpx;
  font-size: 40rpx;
  color: #131410;
  font-weight: 900;
}

.create-hero-copy {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #111310;
  line-height: 1.6;
}

.create-card {
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 30rpx;
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
  min-height: 88rpx;
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

.create-submit-row {
  margin-top: 24rpx;
}

.create-submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 92rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #131410;
  font-size: 30rpx;
  font-weight: 900;
}

.create-submit-button-disabled {
  background: #d7dcd0;
  color: #686d64;
}
</style>
