<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSegmentedControl from "@/components/neo/NeoSegmentedControl.vue";
import NeoStickyActionBar from "@/components/neo/NeoStickyActionBar.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import type { NeoSegmentOption } from "@/components/neo/NeoSegmentedControl.vue";
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
const paymentModeOptions: NeoSegmentOption[] = [
  { label: "赛后支付", value: "postpaid" },
  { label: "赛前支付", value: "prepaid" },
];
const paymentModeCaption = computed(() =>
  form.paymentMode === "prepaid" ? "报名后 20 分钟内支付" : "报名后可随时支付",
);
// 高级设置仅散人约队展示；场地与费用卡片的序号跟随其是否渲染。
const venueMarker = computed(() => (challengeKind.value === "individual" ? "03" : "02"));

function handlePaymentModeChange(value: string) {
  form.paymentMode = value === "prepaid" ? "prepaid" : "postpaid";
}

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

    <view class="create-page-content">
      <NeoSurface variant="dark" custom-class="create-hero">
        <view class="create-hero__copy">
          <text class="create-hero-tag">{{ challengeKind === "team" ? "球队约队" : "散人约队" }}</text>
          <text class="create-hero-title">{{
            currentIdentity ? `${currentIdentity.label} · ${currentIdentity.roleLabel}` : "请选择发布身份"
          }}</text>
          <text class="create-hero-copy">{{ heroCopy }}</text>
        </view>
      </NeoSurface>

      <NeoSurface custom-class="form-card">
        <NeoSectionHeader title="基础信息" marker="01" caption="标题、日期、赛制与支付方式" />
        <view class="form-field">
          <text class="form-label">标题</text>
          <input v-model="form.title" class="form-input" placeholder="例如：周三晚散人局，还缺 4 人" placeholder-class="form-placeholder" />
        </view>
        <view class="form-grid">
          <view class="form-field">
            <text class="form-label">日期</text>
            <picker mode="date" :value="form.date" @change="handleDateChange">
              <view class="form-input form-picker">{{ form.date || "选择日期" }}</view>
            </picker>
          </view>
          <view class="form-field">
            <text class="form-label">赛制</text>
            <picker :value="form.playersPerTeam === '5' ? 0 : 1" :range="['5 人制（共 10 人）', '8 人制（共 16 人）']" @change="handleFormatChange">
              <view class="form-input form-picker">{{ form.playersPerTeam }} 人制 · 默认 {{ defaultMinPlayers }} 人开踢</view>
            </picker>
          </view>
          <view class="form-field">
            <text class="form-label">开始时间</text>
            <picker mode="time" :value="form.startTime" @change="handleStartTimeChange">
              <view class="form-input form-picker">{{ form.startTime }}</view>
            </picker>
          </view>
          <view class="form-field">
            <text class="form-label">结束时间</text>
            <picker mode="time" :value="form.endTime" @change="handleEndTimeChange">
              <view class="form-input form-picker">{{ form.endTime }}</view>
            </picker>
          </view>
        </view>
        <view v-if="challengeKind === 'individual'" class="form-field">
          <text class="form-label">支付方式</text>
          <NeoSegmentedControl
            :model-value="form.paymentMode"
            :options="paymentModeOptions"
            @change="handlePaymentModeChange"
          />
          <text class="form-caption">{{ paymentModeCaption }}</text>
        </view>
      </NeoSurface>

      <NeoSurface v-if="challengeKind === 'individual'" custom-class="form-card">
        <NeoSectionHeader
          title="高级设置"
          marker="02"
          :caption="`默认 ${defaultMinPlayers} 人开踢，最多 ${defaultMaxPlayers} 人`"
          :action-label="advancedOpen ? '收起' : '展开'"
          @action="advancedOpen = !advancedOpen"
        />
        <view v-if="advancedOpen" class="form-grid">
          <view class="form-field">
            <text class="form-label">最少成行人数</text>
            <input v-model="form.minPlayers" class="form-input" type="number" :placeholder="`${defaultMinPlayers}`" placeholder-class="form-placeholder" />
          </view>
          <view class="form-field">
            <text class="form-label">最多报名人数</text>
            <input v-model="form.maxPlayers" class="form-input" type="number" :placeholder="`${defaultMaxPlayers}`" placeholder-class="form-placeholder" />
          </view>
        </view>
      </NeoSurface>

      <NeoSurface custom-class="form-card">
        <NeoSectionHeader title="场地与费用" :marker="venueMarker" caption="场地支持文字地址或地图选择" />
        <view class="form-field">
          <text class="form-label">场地</text>
          <view class="form-location-row">
            <input
              v-model="form.location"
              class="form-input form-location-input"
              placeholder="填写球场名称"
              placeholder-class="form-placeholder"
              @input="handleLocationInput"
            />
            <view class="form-location-button" @tap="handleChooseLocation">
              {{ form.location ? "重新选择" : "选择地点" }}
            </view>
          </view>
          <text v-if="form.locationLatitude != null && form.locationLongitude != null" class="form-hint">
            已选择地图位置，详情页可直接打开地图。
          </text>
        </view>
        <view class="form-field">
          <text class="form-label">预计费用/人</text>
          <input v-model="form.feePerPerson" class="form-input" type="digit" placeholder="25" placeholder-class="form-placeholder" />
        </view>
        <view class="form-field">
          <text class="form-label">备注</text>
          <textarea v-model="form.note" class="form-textarea" maxlength="200" placeholder="例如：缺后卫和门将，守时优先" placeholder-class="form-placeholder" />
        </view>
      </NeoSurface>
    </view>

    <NeoStickyActionBar>
      <NeoButton block variant="lime" :disabled="!canSubmit" :loading="submitting" @click="handleSubmit">
        {{ submitting ? "发布中..." : challengeKind === "team" ? "发布球队约队" : "发布散人约队" }}
      </NeoButton>
    </NeoStickyActionBar>
  </view>
</template>

<style scoped>
.individual-create-page {
  min-height: 100vh;
  padding: 0 28rpx 132rpx;
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.create-page-content {
  max-width: 900rpx;
  margin: 0 auto;
}

.create-hero {
  margin: 22rpx 0 6rpx;
  padding: 28rpx 26rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-hero);
  box-shadow: 8rpx 8rpx 0 var(--neo-color-accent);
}

.create-hero__copy {
  min-width: 0;
}

.create-hero-tag {
  display: inline-flex;
  padding: 6rpx 14rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  font-size: 22rpx;
  font-weight: 900;
}

.create-hero-title {
  display: block;
  margin-top: 14rpx;
  color: var(--neo-color-text-inverse);
  font-size: 40rpx;
  font-weight: 900;
  line-height: 1.18;
  word-break: break-word;
}

.create-hero-copy {
  display: block;
  margin-top: 12rpx;
  color: rgba(255, 255, 255, 0.72);
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.55;
}

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
.form-textarea {
  width: 100%;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.form-input {
  display: flex;
  align-items: center;
  height: 84rpx;
  padding: 0 20rpx;
}

.form-picker {
  display: flex;
  align-items: center;
}

.form-placeholder {
  color: var(--neo-color-text-disabled);
  font-size: 28rpx;
}

.form-textarea {
  min-height: 176rpx;
  padding: 20rpx;
  line-height: 1.5;
}

.form-location-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150rpx;
  align-items: center;
  gap: 14rpx;
}

.form-location-input {
  width: auto;
  min-width: 0;
}

.form-location-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 150rpx;
  height: 84rpx;
  padding: 0 14rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-text);
  color: var(--neo-color-text-inverse);
  font-size: 23rpx;
  font-weight: 900;
  white-space: nowrap;
  box-sizing: border-box;
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
</style>
