<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import MatchPublishForm from "@/components/MatchPublishForm.vue";
import type { MatchPublishFormModel } from "@/components/matchPublishForm";
import { createActivity } from "@/api/activity";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";

const { currentTeam, ensureSessionReady } = useTeamContext();
const navMetrics = getCustomNavMetrics();

const submitting = ref(false);
const form = reactive<MatchPublishFormModel>({
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

function handleLocationInput() {
  form.locationLatitude = null;
  form.locationLongitude = null;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toBackendDateTime(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
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

    <MatchPublishForm
      :model-value="form"
      mode="match"
      :time-valid-message="timeValidMessage"
      @location-input="handleLocationInput"
      @choose-location="handleChooseLocation"
    />

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
