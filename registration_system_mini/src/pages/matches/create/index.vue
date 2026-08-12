<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import MatchPublishForm from "@/components/MatchPublishForm.vue";
import type { MatchPublishFormModel } from "@/components/matchPublishForm";
import { getActivity, updateActivity } from "@/api/activity";
import { createMatch } from "@/api/match";
import { preloadMiniReviewStatus, useMiniReviewStatus } from "@/stores/miniReview";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";
import { buildGoCreateMatchPayload } from "./createMatchPayload";

const { currentTeam, ensureSessionReady } = useTeamContext();
const { shouldHideCreationEntrances } = useMiniReviewStatus();
const navMetrics = getCustomNavMetrics();

const submitting = ref(false);
const loadingActivity = ref(false);
const reviewGateReady = ref(false);
const pageMode = ref<"create" | "edit">("create");
const activityId = ref("");
const form = reactive<MatchPublishFormModel>({
  name: "",
  location: "",
  locationLatitude: null as number | null,
  locationLongitude: null as number | null,
  holdingDate: 0,
  matchEndTime: 0,
  startTime: 0,
  endTime: 0,
  opposing: "",
  description: "",
  playersPerTeam: "" as string | number,
  color: "#2F6BFF",
  opposingColor: "#C8FF00",
  publicationMode: "online_team",
  legacyMatchKind: "external",
  enableCheckIn: false,
  checkInRadiusMeters: 200,
  openMinutesBefore: 60,
  closeMinutesAfter: 45,
});

function normalizeToMinute(timestamp: number) {
  const date = new Date(timestamp);
  date.setSeconds(0, 0);
  return date.getTime();
}

function defaultRegistrationStartTime(holdingDate: number) {
  return normalizeToMinute(holdingDate - 24 * 60 * 60 * 1000);
}

function defaultRegistrationEndTime(holdingDate: number) {
  return normalizeToMinute(holdingDate - 24 * 60 * 60 * 1000);
}

const timeValid = computed(() => {
  if (!form.holdingDate || !form.matchEndTime) return false;
  if (form.holdingDate >= form.matchEndTime) return false;
  return true;
});

const timeValidMessage = computed(() => {
  if (!form.holdingDate || !form.matchEndTime) return "请选择比赛日期和开始结束时间";
  if (form.holdingDate >= form.matchEndTime) return "比赛结束时间应晚于比赛开始时间";
  return "";
});

const canSubmit = computed(
  () =>
    !!currentTeam.value &&
    currentTeam.value.canManageTeam &&
    !!form.name.trim() &&
    !!form.location.trim() &&
    (form.publicationMode !== "offline_confirmed" || !!form.opposing.trim()) &&
    Number(form.playersPerTeam) > 0 &&
    form.holdingDate > 0 &&
    form.matchEndTime > 0 &&
    timeValid.value,
);

const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toBackendDateTime(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function parseBackendDateTime(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value.replace(" ", "T")).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function defaultMatchDateTime() {
  const date = new Date();
  date.setHours(20, 0, 0, 0);
  return normalizeToMinute(date.getTime());
}

function defaultMatchEndDateTime(holdingDate: number) {
  return normalizeToMinute(holdingDate + 2 * 60 * 60 * 1000);
}

function initDefaultForm() {
  const defaultHoldingDate = defaultMatchDateTime();
  form.name = "";
  form.location = "";
  form.locationLatitude = null;
  form.locationLongitude = null;
  form.holdingDate = defaultHoldingDate;
  form.matchEndTime = defaultMatchEndDateTime(defaultHoldingDate);
  form.startTime = defaultRegistrationStartTime(defaultHoldingDate);
  form.endTime = defaultRegistrationEndTime(defaultHoldingDate);
  form.opposing = "";
  form.description = "";
  form.playersPerTeam = 8;
  form.color = "#2F6BFF";
  form.opposingColor = "#C8FF00";
  form.publicationMode = "online_team";
  form.legacyMatchKind = "external";
  form.enableCheckIn = false;
  form.checkInRadiusMeters = 200;
  form.openMinutesBefore = 60;
  form.closeMinutesAfter = 45;
}

function handleLocationInput() {
  form.locationLatitude = null;
  form.locationLongitude = null;
}

function handleChooseLocation() {
  uni.chooseLocation({
    success(location) {
      form.location = location.name || location.address || "";
      form.locationLatitude = location.latitude;
      form.locationLongitude = location.longitude;
    },
    fail() {
      uni.showToast({
        title: "未选择地点",
        icon: "none",
      });
    },
  });
}

function applyActivityToForm(activity: Awaited<ReturnType<typeof getActivity>>) {
  form.name = activity.name ?? "";
  form.location = activity.location ?? "";
  form.locationLatitude = activity.location_latitude ?? null;
  form.locationLongitude = activity.location_longitude ?? null;
  form.holdingDate = parseBackendDateTime(activity.holding_date);
  form.matchEndTime = defaultMatchEndDateTime(form.holdingDate);
  form.startTime = parseBackendDateTime(activity.start_time);
  form.endTime = parseBackendDateTime(activity.end_time);
  form.opposing = activity.opposing ?? "";
  form.description = activity.description ?? "";
  form.playersPerTeam = activity.players_per_team ?? "";
  form.color = activity.color?.trim() || "#2F6BFF";
  form.opposingColor = activity.opposing_color?.trim() || "#C8FF00";
  form.legacyMatchKind = activity.match_kind === "internal" ? "internal" : "external";
  form.publicationMode = "offline_confirmed";
  const checkInConfig = activity.team_checkin_configs.find((item) => item.team_id === currentTeam.value?.id);
  form.enableCheckIn = !!checkInConfig?.enabled;
  form.checkInRadiusMeters = checkInConfig?.radius_meters ?? 200;
  form.openMinutesBefore = checkInConfig?.open_minutes_before ?? 60;
  form.closeMinutesAfter = checkInConfig?.close_minutes_after ?? 45;
}

async function loadEditActivity() {
  if (pageMode.value !== "edit" || !activityId.value) return;
  loadingActivity.value = true;
  try {
    const activity = await getActivity(activityId.value);
    applyActivityToForm(activity);
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "读取比赛失败",
      icon: "none",
    });
  } finally {
    loadingActivity.value = false;
  }
}

async function guardReviewMode() {
  await preloadMiniReviewStatus();
  if (!shouldHideCreationEntrances.value) return false;

  uni.showToast({
    title: "审核状态下暂不开放创建比赛",
    icon: "none",
  });
  setTimeout(() => {
    uni.navigateBack({
      fail: () => {
        uni.switchTab({ url: "/pages/home/index" });
      },
    });
  }, 120);
  return true;
}

async function handleSubmit() {
  if (await guardReviewMode()) return;

  if (!currentTeam.value || !currentTeam.value.canManageTeam) {
    uni.showToast({
      title: "只有队长或领队可以创建或编辑比赛",
      icon: "none",
    });
    return;
  }

  if (!canSubmit.value || submitting.value) {
    uni.showToast({
      title:
        !timeValid.value
            ? timeValidMessage.value
            : "请先补全比赛信息",
      icon: "none",
    });
    return;
  }

  submitting.value = true;
  try {
    if (pageMode.value === "edit" && activityId.value) {
      const submittedAtTimestamp = Date.now();
      const registrationDeadlineTimestamp = normalizeToMinute(form.holdingDate - 24 * 60 * 60 * 1000);
      await updateActivity(activityId.value, {
        name: form.name.trim(),
        location: form.location.trim(),
        location_latitude: form.locationLatitude,
        location_longitude: form.locationLongitude,
        holding_date: toBackendDateTime(form.holdingDate),
        start_time: toBackendDateTime(submittedAtTimestamp),
        end_time: toBackendDateTime(registrationDeadlineTimestamp),
        opposing: form.opposing.trim() || null,
        description: form.description.trim() || null,
        home_team_id: currentTeam.value.id,
        players_per_team: Number(form.playersPerTeam),
        color: form.color || null,
        opposing_color: form.opposingColor || null,
        match_kind: form.legacyMatchKind ?? "external",
      });
      uni.showToast({
        title: "比赛已保存",
        icon: "none",
      });
      uni.redirectTo({
        url: `/pages/matches/detail?id=${activityId.value}`,
      });
      return;
    }

    const detail = await createMatch(buildGoCreateMatchPayload(form, currentTeam.value));
    const hostGroupId = detail.groups.find((group) => group.team_id === currentTeam.value?.id)?.id ?? detail.groups[0]?.id;
    uni.showToast({
      title: "比赛已创建",
      icon: "none",
    });
    uni.redirectTo({
      url: `/pages/matches/detail?id=${detail.match.id}${hostGroupId ? `&groupId=${hostGroupId}` : ""}`,
    });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : pageMode.value === "edit" ? "保存比赛失败" : "创建比赛失败",
      icon: "none",
    });
  } finally {
    submitting.value = false;
  }
}

onLoad((options) => {
  pageMode.value = options?.mode === "edit" ? "edit" : "create";
  activityId.value = options?.id ?? "";
});

onShow(async () => {
  reviewGateReady.value = false;
  if (await guardReviewMode()) return;
  reviewGateReady.value = true;
  await ensureSessionReady();
  if (!form.holdingDate) {
    initDefaultForm();
  }
  await loadEditActivity();
});
</script>

<template>
  <view v-if="reviewGateReady" class="create-match-page" :style="pageStyle">
    <AppTabHeader :title="pageMode === 'edit' ? '编辑比赛' : '创建比赛'" showBack />

    <view class="create-hero">
      <view>
        <wd-text custom-class="create-hero-tag" color="#111310" :text="pageMode === 'edit' ? '编辑比赛' : '创建比赛'" />
        <wd-text custom-class="create-hero-title" color="#111310" :text="currentTeam?.name || '当前球队'" />
      </view>
    </view>

    <view v-if="loadingActivity" class="create-skeleton-form">
      <view class="create-skeleton-line create-skeleton-line-title" />
      <view class="create-skeleton-line" />
      <view class="create-skeleton-line" />
      <view class="create-skeleton-grid">
        <view class="create-skeleton-pill" />
        <view class="create-skeleton-pill" />
      </view>
    </view>

    <MatchPublishForm
      v-else
      :model-value="form"
      mode="match"
      :show-check-in="false"
      :time-valid-message="timeValidMessage"
      @location-input="handleLocationInput"
      @choose-location="handleChooseLocation"
    />

    <view class="create-submit-row">
      <view :class="['create-submit-button', !canSubmit ? 'create-submit-button-disabled' : '']" @tap="canSubmit ? handleSubmit() : null">
        {{ submitting ? (pageMode === 'edit' ? '保存中...' : '创建中...') : pageMode === 'edit' ? '保存修改' : '创建比赛' }}
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

.create-skeleton-form,
.create-skeleton-line,
.create-skeleton-pill {
  position: relative;
  overflow: hidden;
}

.create-skeleton-form {
  margin-top: 18rpx;
  padding: 28rpx;
  border-radius: 30rpx;
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.create-skeleton-line {
  height: 28rpx;
  border-radius: 999rpx;
  background: #e5eadf;
}

.create-skeleton-line + .create-skeleton-line {
  margin-top: 20rpx;
}

.create-skeleton-line-title {
  width: 42%;
  height: 38rpx;
}

.create-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 26rpx;
}

.create-skeleton-pill {
  height: 96rpx;
  border-radius: 22rpx;
  background: #eef2e8;
}

.create-skeleton-line::after,
.create-skeleton-pill::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.78) 50%, transparent 100%);
  animation: create-skeleton-shimmer 1.2s ease-in-out infinite;
}

@keyframes create-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
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
