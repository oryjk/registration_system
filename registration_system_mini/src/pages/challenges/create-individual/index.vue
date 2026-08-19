<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import MatchScheduleFields from "@/components/MatchScheduleFields.vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSegmentedControl from "@/components/neo/NeoSegmentedControl.vue";
import NeoStickyActionBar from "@/components/neo/NeoStickyActionBar.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import type { NeoSegmentOption } from "@/components/neo/NeoSegmentedControl.vue";
import { createMatch } from "@/api/match";
import { preloadMiniReviewStatus, useMiniReviewStatus } from "@/stores/miniReview";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";

// 散人约球（online_pickup）：所有参与者都是散人、无球队概念，任何登录用户可发布。
const { ensureSessionReady } = useTeamContext();
const { shouldHideCreationEntrances } = useMiniReviewStatus();
const navMetrics = getCustomNavMetrics();
const submitting = ref(false);
const reviewGateReady = ref(false);

const form = reactive({
  title: "",
  paymentMode: "postpaid" as "prepaid" | "postpaid",
  location: "",
  locationLatitude: null as number | null,
  locationLongitude: null as number | null,
  playersPerTeam: "8",
  maxPlayers: "",
  feePerPerson: "",
  note: "",
});

// 比赛时间与散人对手（创建比赛）共用 MatchScheduleFields：近 7 日横滑卡 + 更多日期日历 + 时间磁贴。
const holdingDate = ref(defaultTodayAt(20));
const matchEndTime = ref(defaultTodayAt(22));

const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));
const heroCopy = "所有参与者都是散人，发布后球员可直接报名。";

const canSubmit = computed(
  () =>
    !!form.title.trim() &&
    !!form.location.trim() &&
    Number(form.playersPerTeam) > 0 &&
    !submitting.value,
);
const defaultMinPlayers = computed(() => Number(form.playersPerTeam || 0) * 2);
const defaultMaxPlayers = computed(() => Number(form.playersPerTeam || 0) * 2 + 4);
const paymentModeOptions: NeoSegmentOption[] = [
  { label: "赛后支付", value: "postpaid" },
  { label: "赛前支付", value: "prepaid" },
];
const paymentModeCaption = computed(() =>
  form.paymentMode === "prepaid" ? "报名时需立即支付报名费" : "报名后可随时支付",
);

function defaultTodayAt(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
}

// Go 后端 time.Time 只接受带时区的 RFC3339（如 ...T18:00:00.000Z），不能发本地无时区格式。
function toBackendDateTime(timestamp: number) {
  return new Date(timestamp).toISOString();
}

function handlePaymentModeChange(value: string) {
  form.paymentMode = value === "prepaid" ? "prepaid" : "postpaid";
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

function validateForm() {
  if (!form.title.trim() || !form.location.trim()) return "请补全标题和场地";

  const playersPerTeam = Number(form.playersPerTeam || 0);
  if (!Number.isFinite(playersPerTeam) || playersPerTeam <= 0) return "请填写正确的比赛人制";

  const maxPlayers = form.maxPlayers ? Number(form.maxPlayers) : null;
  if (maxPlayers !== null && (!Number.isFinite(maxPlayers) || maxPlayers <= 0)) return "请填写正确的最大人数";
  if (maxPlayers !== null && maxPlayers < defaultMinPlayers.value) return `最大人数不能少于成行的 ${defaultMinPlayers} 人`;

  const feePerPerson = form.feePerPerson ? Number(form.feePerPerson) : null;
  if (feePerPerson !== null && (!Number.isFinite(feePerPerson) || feePerPerson < 0)) return "请填写正确的费用";
  if (form.paymentMode === "prepaid" && !feePerPerson) return "赛前支付需填写人均报名费";

  if (matchEndTime.value <= holdingDate.value) return "结束时间必须晚于开始时间";

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
  const feePerPersonCents = feePerPerson !== null ? Math.round(feePerPerson * 100) : 0;
  submitting.value = true;
  try {
    const detail = await createMatch({
      name: form.title.trim(),
      publication_mode: "online_pickup",
      players_per_team: Number(form.playersPerTeam),
      host_capacity_limit: form.maxPlayers ? Number(form.maxPlayers) : undefined,
      start_time: toBackendDateTime(holdingDate.value),
      end_time: toBackendDateTime(matchEndTime.value),
      location: form.location.trim(),
      location_latitude: form.locationLatitude ?? undefined,
      location_longitude: form.locationLongitude ?? undefined,
      description: form.note.trim() || undefined,
      is_free: feePerPersonCents <= 0,
      payment_mode: form.paymentMode,
      fee_per_person_cents: feePerPersonCents,
    });

    uni.showToast({
      title: "散人约球已发布",
      icon: "none",
    });
    const group = detail.groups.find((item) => item.kind === "individual_opponent") ?? detail.groups[0];
    uni.redirectTo({
      url: `/pages/matches/detail?id=${detail.match.id}${group ? `&groupId=${group.id}` : ""}`,
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
    title: "审核状态下暂不开放散人约球",
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
  // 从地图选点等原生页返回会再次触发 onShow；reviewGateReady 已置位时不再重建页面，
  // 否则 v-if 整页卸载重挂会把滚动位置重置回顶部。
  if (!reviewGateReady.value) {
    if (await guardReviewMode()) return;
    reviewGateReady.value = true;
  }
  await ensureSessionReady();
});
</script>

<template>
  <view v-if="reviewGateReady" class="individual-create-page" :style="pageStyle">
    <AppTabHeader title="散人约球" showBack />

    <view class="create-page-content">
      <NeoSurface variant="dark" custom-class="create-hero">
        <view class="create-hero__copy">
          <text class="create-hero-tag">散人约球</text>
          <text class="create-hero-title">无球队 · 散人直接报名</text>
          <text class="create-hero-copy">{{ heroCopy }}</text>
        </view>
      </NeoSurface>

      <NeoSurface custom-class="form-card">
        <NeoSectionHeader title="基础信息" marker="01" caption="标题与比赛人制" />
        <view class="form-field">
          <text class="form-label">标题</text>
          <input v-model="form.title" class="form-input" placeholder="例如：周三晚散人局，还缺 4 人" placeholder-class="form-placeholder" />
        </view>
        <view class="form-grid">
          <view class="form-field">
            <text class="form-label">比赛人制</text>
            <input
              v-model="form.playersPerTeam"
              class="form-input"
              type="number"
              placeholder="8"
              placeholder-class="form-placeholder"
            />
          </view>
          <view class="form-field">
            <text class="form-label">最大人数</text>
            <input
              v-model="form.maxPlayers"
              class="form-input"
              type="number"
              :placeholder="`${defaultMaxPlayers}`"
              placeholder-class="form-placeholder"
            />
          </view>
        </view>
        <text class="form-caption form-caption-field">
          比赛人制为每队人数；默认 {{ defaultMinPlayers }} 人开踢，最多 {{ form.maxPlayers || defaultMaxPlayers }} 人。
        </text>
      </NeoSurface>

      <NeoSurface custom-class="form-card">
        <MatchScheduleFields
          :holding-date="holdingDate"
          :match-end-time="matchEndTime"
          @update:holding-date="holdingDate = $event"
          @update:match-end-time="matchEndTime = $event"
        />
      </NeoSurface>

      <NeoSurface custom-class="form-card">
        <NeoSectionHeader title="场地与费用" marker="02" caption="场地支持文字地址或地图选择" />
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
          <textarea
            v-model="form.note"
            class="form-textarea"
            maxlength="200"
            placeholder="例如：缺后卫和门将，守时优先"
            placeholder-class="form-placeholder"
            :adjust-position="true"
            :cursor-spacing="120"
            :show-confirm-bar="false"
          />
        </view>
      </NeoSurface>

      <NeoSurface custom-class="form-card">
        <NeoSectionHeader title="支付方式" marker="03" caption="报名费的付款节奏" />
        <view class="form-field">
          <NeoSegmentedControl
            :model-value="form.paymentMode"
            :options="paymentModeOptions"
            @change="handlePaymentModeChange"
          />
          <text class="form-caption">{{ paymentModeCaption }}</text>
        </view>
      </NeoSurface>
    </view>

    <NeoStickyActionBar>
      <NeoButton block variant="lime" :disabled="!canSubmit" :loading="submitting" @click="handleSubmit">
        {{ submitting ? "发布中..." : "发布散人约球" }}
      </NeoButton>
    </NeoStickyActionBar>
  </view>
</template>

<style scoped>
.individual-create-page {
  min-height: 100vh;
  /* 底部留白用操作栏 clearance token：含悬浮操作栏高度与全面屏安全区，硬编码 132rpx 会被按钮遮挡。 */
  padding: 0 28rpx var(--neo-action-bar-clearance);
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

.form-caption-field {
  margin-top: 16rpx;
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
