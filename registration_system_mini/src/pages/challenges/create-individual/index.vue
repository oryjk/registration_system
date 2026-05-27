<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import { createChallenge } from "@/api/challenge";
import { preloadMiniReviewStatus, useMiniReviewStatus } from "@/stores/miniReview";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";

const { currentIdentity, ensureSessionReady } = useTeamContext();
const { shouldHideCreationEntrances } = useMiniReviewStatus();
const navMetrics = getCustomNavMetrics();
const submitting = ref(false);
const reviewGateReady = ref(false);
const challengeKind = ref<"team" | "individual">("individual");
const advancedOpen = ref(false);

const form = reactive({
  title: "",
  paymentMode: "postpaid" as "prepaid" | "postpaid",
  date: "",
  startTime: "20:00",
  endTime: "22:00",
  location: "",
  locationLatitude: null as number | null,
  locationLongitude: null as number | null,
  playersPerTeam: "8",
  minPlayers: "",
  maxPlayers: "",
  feePerPerson: "",
  note: "",
});

const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));
const heroCopy = computed(() => {
  if (challengeKind.value === "individual") {
    return "散人约队同一时间只能接一场，发布后球员可直接报名。";
  }

  return currentIdentity.value?.kind === "venue"
    ? "场馆发布后，两支球队可以依次应战，第一支球队占位后会先生成等待对手的比赛。"
    : "球队发布后，其他球队队长或领队可以接约。";
});

const canSubmit = computed(
  () =>
    !!currentIdentity.value &&
    !!form.title.trim() &&
    !!form.date &&
    !!form.startTime &&
    !!form.endTime &&
    !!form.location.trim() &&
    !submitting.value,
);
const defaultMinPlayers = computed(() => Number(form.playersPerTeam || 0) * 2);
const defaultMaxPlayers = computed(() => Number(form.playersPerTeam || 0) * 2 + 4);

function defaultPublishDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function combineDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}

function handleDateChange(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  form.date = detail.detail?.value ?? form.date;
}

function handleStartTimeChange(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  form.startTime = detail.detail?.value ?? form.startTime;
}

function handleEndTimeChange(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  form.endTime = detail.detail?.value ?? form.endTime;
}

function handleFormatChange(event: Event) {
  const detail = event as Event & { detail?: { value?: number | string } };
  form.playersPerTeam = Number(detail.detail?.value ?? 1) === 0 ? "5" : "8";
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

function canPublishChallenge() {
  return !!currentIdentity.value;
}

function validateForm() {
  if (!canPublishChallenge()) return "请先在我的页面选择球队或场馆身份";
  if (!form.title.trim() || !form.date || !form.location.trim()) return "请补全标题、日期和场地";

  const playersPerTeam = Number(form.playersPerTeam || 0);
  if (!Number.isFinite(playersPerTeam) || ![5, 8].includes(playersPerTeam)) return "请选择 5 人制或 8 人制";

  const feePerPerson = form.feePerPerson ? Number(form.feePerPerson) : null;
  if (feePerPerson !== null && (!Number.isFinite(feePerPerson) || feePerPerson < 0)) return "请填写正确的费用";

  if (challengeKind.value === "individual") {
    const minPlayers = form.minPlayers ? Number(form.minPlayers) : null;
    const maxPlayers = form.maxPlayers ? Number(form.maxPlayers) : null;
    if (minPlayers !== null && (!Number.isFinite(minPlayers) || minPlayers <= 0)) return "请填写正确的最少成行人数";
    if (maxPlayers !== null && (!Number.isFinite(maxPlayers) || maxPlayers <= 0)) return "请填写正确的最多报名人数";
    const resolvedMinPlayers = minPlayers ?? defaultMinPlayers.value;
    const resolvedMaxPlayers = maxPlayers ?? defaultMaxPlayers.value;
    if (resolvedMinPlayers > resolvedMaxPlayers) return "最少成行人数不能大于最多报名人数";
  }

  if (combineDateTime(form.date, form.endTime) <= combineDateTime(form.date, form.startTime)) return "结束时间必须晚于开始时间";

  return "";
}

async function handleSubmit() {
  if (await guardReviewMode()) return;

  if (submitting.value) return;

  const message = validateForm();
  if (message) {
    uni.showToast({
      title: message,
      icon: "none",
    });
    return;
  }

  const feePerPerson = form.feePerPerson ? Number(form.feePerPerson) : null;
  const minPlayers = challengeKind.value === "individual" && form.minPlayers ? Number(form.minPlayers) : null;
  const maxPlayers = challengeKind.value === "individual" && form.maxPlayers ? Number(form.maxPlayers) : null;
  submitting.value = true;
  try {
    const challenge = await createChallenge({
      kind: challengeKind.value,
      payment_mode: challengeKind.value === "individual" ? form.paymentMode : "postpaid",
      host_team_id: currentIdentity.value?.kind === "team" ? currentIdentity.value.teamId : undefined,
      title: form.title.trim(),
      holding_date: combineDateTime(form.date, form.startTime),
      start_time: combineDateTime(form.date, form.startTime),
      end_time: combineDateTime(form.date, form.endTime),
      location: form.location.trim(),
      location_latitude: form.locationLatitude ?? undefined,
      location_longitude: form.locationLongitude ?? undefined,
      players_per_team: Number(form.playersPerTeam),
      min_players: minPlayers ?? undefined,
      max_players: maxPlayers ?? undefined,
      fee_per_person: feePerPerson !== null ? feePerPerson.toFixed(2) : undefined,
      note: form.note.trim() || undefined,
    });

    uni.showToast({
      title: challengeKind.value === "team" ? "球队约队已发布" : "散人约队已发布",
      icon: "none",
    });
    uni.redirectTo({
      url: `/pages/challenges/detail?id=${challenge.id}`,
    });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "发布失败",
      icon: "none",
    });
  } finally {
    submitting.value = false;
  }
}

async function guardReviewMode() {
  await preloadMiniReviewStatus();
  if (!shouldHideCreationEntrances.value) return false;

  uni.showToast({
    title: challengeKind.value === "team" ? "审核状态下暂不开放球队约队" : "审核状态下暂不开放散人约球",
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

onShow(async () => {
  reviewGateReady.value = false;
  if (await guardReviewMode()) return;
  reviewGateReady.value = true;
  await ensureSessionReady();
  if (!form.date) {
    form.date = defaultPublishDate();
  }
});

onLoad((options) => {
  challengeKind.value = options?.kind === "team" ? "team" : "individual";
  if (challengeKind.value === "team" && !form.title.trim()) {
    form.title = "周三晚球队约队";
  }
});
</script>

<template>
  <view v-if="reviewGateReady" class="individual-create-page" :style="pageStyle">
    <AppTabHeader :title="challengeKind === 'team' ? '球队约队' : '散人约队'" showBack />

    <view class="create-hero">
      <view>
        <wd-text custom-class="create-hero-tag" color="#111310" :text="challengeKind === 'team' ? '球队约队' : '散人约队'" />
        <wd-text
          custom-class="create-hero-title"
          color="#111310"
          :text="currentIdentity ? `${currentIdentity.label} · ${currentIdentity.roleLabel}` : '请选择发布身份'"
        />
        <wd-text
          custom-class="create-hero-copy"
          color="#111310"
          :text="heroCopy"
        />
      </view>
    </view>

    <view class="create-card">
      <view class="create-card-title">基础信息</view>
      <view class="create-form-grid">
        <view class="create-form-item create-form-item-full">
          <text class="create-form-label">标题</text>
          <input v-model="form.title" class="create-input" placeholder="例如：周三晚散人局，还缺 4 人" />
        </view>
        <view class="create-form-item">
          <text class="create-form-label">日期</text>
          <picker mode="date" :value="form.date" @change="handleDateChange">
            <view class="create-input create-picker">{{ form.date || "选择日期" }}</view>
          </picker>
        </view>
        <view class="create-form-item">
          <text class="create-form-label">赛制</text>
          <picker :value="form.playersPerTeam === '5' ? 0 : 1" :range="['5 人制（共 10 人）', '8 人制（共 16 人）']" @change="handleFormatChange">
            <view class="create-input create-picker">{{ form.playersPerTeam }} 人制 · 默认 {{ defaultMinPlayers }} 人开踢</view>
          </picker>
        </view>
        <view class="create-form-item">
          <text class="create-form-label">开始时间</text>
          <picker mode="time" :value="form.startTime" @change="handleStartTimeChange">
            <view class="create-input create-picker">{{ form.startTime }}</view>
          </picker>
        </view>
        <view class="create-form-item">
          <text class="create-form-label">结束时间</text>
          <picker mode="time" :value="form.endTime" @change="handleEndTimeChange">
            <view class="create-input create-picker">{{ form.endTime }}</view>
          </picker>
        </view>
        <view v-if="challengeKind === 'individual'" class="create-form-item create-form-item-full">
          <text class="create-form-label">支付方式</text>
          <view class="payment-mode-switch">
            <view
              :class="['payment-mode-option', form.paymentMode === 'postpaid' ? 'payment-mode-option-active' : '']"
              @tap="form.paymentMode = 'postpaid'"
            >
              <text class="payment-mode-title">赛后支付</text>
              <text class="payment-mode-desc">报名后可随时支付</text>
            </view>
            <view
              :class="['payment-mode-option', form.paymentMode === 'prepaid' ? 'payment-mode-option-active' : '']"
              @tap="form.paymentMode = 'prepaid'"
            >
              <text class="payment-mode-title">赛前支付</text>
              <text class="payment-mode-desc">报名后 20 分钟内支付</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="challengeKind === 'individual'" class="create-card">
      <view class="advanced-head" @tap="advancedOpen = !advancedOpen">
        <view>
          <view class="create-card-title">高级设置</view>
          <text class="advanced-summary">默认 {{ defaultMinPlayers }} 人开踢，最多 {{ defaultMaxPlayers }} 人</text>
        </view>
        <text class="advanced-arrow">{{ advancedOpen ? "收起" : "展开" }}</text>
      </view>
      <view v-if="advancedOpen" class="create-form-grid advanced-form">
        <view class="create-form-item">
          <text class="create-form-label">最少成行人数</text>
          <input v-model="form.minPlayers" class="create-input" type="number" :placeholder="`${defaultMinPlayers}`" />
        </view>
        <view class="create-form-item">
          <text class="create-form-label">最多报名人数</text>
          <input v-model="form.maxPlayers" class="create-input" type="number" :placeholder="`${defaultMaxPlayers}`" />
        </view>
      </view>
    </view>

    <view class="create-card">
      <view class="create-card-title">场地与费用</view>
      <view class="create-form-grid">
        <view class="create-form-item create-form-item-full">
          <text class="create-form-label">场地</text>
          <view class="create-location-row">
            <input
              v-model="form.location"
              class="create-input create-location-input"
              placeholder="填写球场名称"
              @input="handleLocationInput"
            />
            <view class="create-location-button" @tap="handleChooseLocation">
              {{ form.location ? "重新选择" : "选择地点" }}
            </view>
          </view>
          <view v-if="form.locationLatitude != null && form.locationLongitude != null" class="create-location-hint">
            已选择地图位置，详情页可直接打开地图。
          </view>
        </view>
        <view class="create-form-item">
          <text class="create-form-label">预计费用/人</text>
          <input v-model="form.feePerPerson" class="create-input" type="digit" placeholder="25" />
        </view>
        <view class="create-form-item create-form-item-full">
          <text class="create-form-label">备注</text>
          <textarea v-model="form.note" class="create-textarea" maxlength="200" placeholder="例如：缺后卫和门将，守时优先" />
        </view>
      </view>
    </view>

    <view class="create-submit-row">
      <view :class="['create-submit-button', !canSubmit ? 'create-submit-button-disabled' : '']" @tap="handleSubmit">
        {{ submitting ? "发布中..." : challengeKind === "team" ? "发布球队约队" : "发布散人约队" }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.individual-create-page {
  min-height: 100vh;
  padding: 30rpx 28rpx 110rpx;
  background:
    radial-gradient(circle at top right, rgba(200, 255, 0, 0.14), transparent 26%),
    linear-gradient(180deg, #ffffff 0%, #f5f6f2 100%);
  box-sizing: border-box;
}

.create-hero,
.create-card {
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.create-hero {
  padding: 28rpx;
  border-radius: 34rpx;
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

.create-card-title {
  display: block;
  font-size: 30rpx;
  color: #171814;
  font-weight: 900;
}

.create-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 22rpx;
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
.create-textarea {
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

.create-picker {
  display: flex;
  align-items: center;
}

.create-textarea {
  min-height: 176rpx;
  padding: 22rpx;
  line-height: 1.5;
}

.create-location-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150rpx;
  align-items: center;
  gap: 14rpx;
}

.create-location-input {
  width: auto;
  min-width: 0;
}

.create-location-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 150rpx;
  height: 88rpx;
  padding: 0 14rpx;
  border-radius: 24rpx;
  background: #111310;
  color: #ffffff;
  font-size: 23rpx;
  font-weight: 900;
  white-space: nowrap;
  box-sizing: border-box;
}

.create-location-hint {
  padding: 16rpx 18rpx;
  border-radius: 20rpx;
  background: #eef8d6;
  color: #526a00;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.5;
}

.payment-mode-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.payment-mode-option {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-height: 112rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  border: 2rpx solid #d7ddd2;
  background: #f4f6f0;
  box-sizing: border-box;
}

.payment-mode-option-active {
  border-color: #111310;
  background: #eef8d6;
}

.payment-mode-title {
  color: #111310;
  font-size: 26rpx;
  font-weight: 900;
}

.payment-mode-desc {
  color: #687064;
  font-size: 21rpx;
  line-height: 1.35;
  font-weight: 700;
}

.advanced-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.advanced-summary {
  display: block;
  margin-top: 8rpx;
  color: #687064;
  font-size: 22rpx;
  font-weight: 700;
}

.advanced-arrow {
  flex-shrink: 0;
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: #eef8d6;
  color: #526a00;
  font-size: 22rpx;
  font-weight: 900;
}

.advanced-form {
  margin-top: 20rpx;
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
