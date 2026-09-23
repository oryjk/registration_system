<script setup lang="ts">
import { usePageRefresh } from "@/composables/usePageRefresh";
import { useAccentTheme } from "@/stores/theme";
import { computed, reactive, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import MatchScheduleFields from "@/components/MatchScheduleFields.vue";
import AppButton from "@/components/ui/AppButton.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import type { SegmentOption } from "@/components/ui/SegmentedControl.vue";
import { createMatch, getMatchDetail, updateMyMatch, getVenueSuggestions } from "@/api/match";
import type { BackendVenueSuggestion } from "@/api/match";
import { preloadMiniReviewStatus, useMiniReviewStatus } from "@/stores/miniReview";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";
import IndividualVenueField from "./IndividualVenueField.vue";
import { mergeVenueHistory, readVenueHistory, rememberVenue } from "./venueHistory";
import type { VenueHistoryItem } from "./venueHistory";

// 散人约球（online_pickup）：所有参与者都是散人、无球队概念，任何登录用户可发布。
const { themePageStyle } = useAccentTheme();

const { currentUser, ensureSessionReady, refreshSessionContext } = useTeamContext();
const { shouldHideCreationEntrances } = useMiniReviewStatus();
const navMetrics = getCustomNavMetrics();
const submitting = ref(false);
const editId = ref("");
const editReady = ref(false);
onLoad((query) => { editId.value = String(query?.editId || ""); });
async function loadEditForm() {
  if (!editId.value || editReady.value) return;
  const detail = await getMatchDetail(editId.value);
  const match = detail.match;
  if (match.publication_mode !== "online_pickup") throw new Error("比赛类型不匹配");
  Object.assign(form, {
    title: match.name, location: match.location,
    locationLatitude: match.location_latitude ?? null, locationLongitude: match.location_longitude ?? null,
    playersPerTeam: String(match.players_per_team),
    maxPlayers: String(detail.groups.find(g => g.kind === "individual_opponent")?.max_players ?? ""),
    feeType: match.fee_type || ((match.fee_per_person_cents ?? 0) > 0 ? "fixed_amount" : match.is_free ? "free" : "offline_aa"),
    paymentMode: match.payment_mode || "postpaid", feePerPerson: String((match.fee_per_person_cents ?? 0) / 100),
    note: match.description || "",
  });
  holdingDate.value = new Date(match.start_time).getTime();
  matchEndTime.value = new Date(match.end_time).getTime();
  editReady.value = true;
}
const reviewGateReady = ref(false);
const localVenues = ref<VenueHistoryItem[]>([]);
const suggestedVenues = ref<BackendVenueSuggestion[]>([]);
const venueSuggestionsRequested = ref(false);
const venueOptions = computed(() => mergeVenueHistory(localVenues.value, suggestedVenues.value));

const form = reactive({
  title: "",
  paymentMode: "postpaid" as "prepaid" | "postpaid",
  location: "",
  locationLatitude: null as number | null,
  locationLongitude: null as number | null,
  playersPerTeam: "8",
  maxPlayers: "",
  feeType: "offline_aa" as import("@/types/match").AppMatchFeeType,
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

const defaultMinPlayers = computed(() => Number(form.playersPerTeam || 0) * 2);
const defaultMaxPlayers = computed(() => Number(form.playersPerTeam || 0) * 2 + 4);
const playerCountValid = computed(() => Number.isInteger(Number(form.playersPerTeam)) && Number(form.playersPerTeam) > 0);
const timeValidMessage = computed(() => matchEndTime.value <= holdingDate.value ? "结束时间须晚于开始时间" : "");
const formIssue = computed(() => validateForm());
const canSubmit = computed(() => !formIssue.value && !submitting.value && (!editId.value || editReady.value));
const submitHint = computed(() => submitting.value ? "正在保存，请稍候…" : formIssue.value || (editId.value ? "保存后，比赛信息将同步更新。" : "发布后，球员可直接查看并报名。"));
const paymentModeOptions: SegmentOption[] = [
  { label: "赛后支付", value: "postpaid" },
  { label: "赛前支付", value: "prepaid" },
];
const feeOptions = [
  { value: "offline_aa", label: "线下 AA", icon: "users" },
  { value: "free", label: "免费", icon: "circle-check" },
  { value: "fixed_amount", label: "具体金额", icon: "wallet" },
] as const;
const paymentModeCaption = computed(() => form.paymentMode === "prepaid"
  ? "球员报名时支付，按报名人数计算。" : "赛后按填写的人均金额结算。");
function selectFeeType(value: typeof form.feeType) {
  form.feeType = value;
  if (value !== "fixed_amount") form.paymentMode = "postpaid";
}

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

async function handleVenueFocus() {
  localVenues.value = readVenueHistory(currentUser.value?.id ?? null);
  if (venueSuggestionsRequested.value) return;
  venueSuggestionsRequested.value = true;
  try {
    suggestedVenues.value = await getVenueSuggestions(10);
  } catch {
    // 已有本地历史和手动输入可继续使用，场地建议失败不阻断发布。
  }
}

function handleVenueSelected(venue: VenueHistoryItem) {
  form.location = venue.location;
  form.locationLatitude = venue.latitude;
  form.locationLongitude = venue.longitude;
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
  if (!form.title.trim()) return "请填写约球标题";
  if (!form.location.trim()) return "请填写球场或在地图选点";

  const playersPerTeam = Number(form.playersPerTeam || 0);
  if (!Number.isInteger(playersPerTeam) || playersPerTeam <= 0) return "比赛人制请输入正整数";

  const maxPlayers = form.maxPlayers ? Number(form.maxPlayers) : null;
  if (maxPlayers !== null && (!Number.isInteger(maxPlayers) || maxPlayers <= 0)) return "最大人数请输入正整数";
  if (maxPlayers !== null && maxPlayers < defaultMinPlayers.value) return `最大人数不能少于成行的 ${defaultMinPlayers.value} 人`;

  if (form.feeType === "fixed_amount") {
    const value = Number(form.feePerPerson);
    if (!/^\d+(\.\d{1,2})?$/.test(form.feePerPerson) || !Number.isFinite(value) || value <= 0) return "请填写人均金额，至少 0.01 元，最多两位小数";
  }

  if (matchEndTime.value <= holdingDate.value) return "结束时间必须晚于开始时间";

  return "";
}

async function handleSubmit() {
  if (!editId.value && await guardReviewMode()) return;

  if (submitting.value || (editId.value && !editReady.value)) return;

  const message = validateForm();
  if (message) {
    uni.showToast({
      title: message,
      icon: "none",
    });
    return;
  }

  const feePerPerson = form.feeType === "fixed_amount" ? Number(form.feePerPerson) : null;
  const feePerPersonCents = feePerPerson !== null ? Math.round(feePerPerson * 100) : 0;
  submitting.value = true;
  try {
    const payload = {
      name: form.title.trim(),
      publication_mode: "online_pickup" as const,
      players_per_team: Number(form.playersPerTeam),
      host_capacity_limit: form.maxPlayers ? Number(form.maxPlayers) : undefined,
      start_time: toBackendDateTime(holdingDate.value),
      end_time: toBackendDateTime(matchEndTime.value),
      location: form.location.trim(),
      location_latitude: form.locationLatitude ?? undefined,
      location_longitude: form.locationLongitude ?? undefined,
      description: form.note.trim(),
      is_free: form.feeType === "free",
      fee_type: form.feeType,
      payment_mode: form.paymentMode,
      fee_per_person_cents: feePerPersonCents,
    };
    const detail = editId.value
      ? await updateMyMatch(editId.value, { ...payload, max_players: Number(form.maxPlayers || defaultMaxPlayers.value) })
      : await createMatch(payload);
    uni.$emit("home:data-may-changed");

    rememberVenue(currentUser.value?.id ?? null, {
      location: form.location.trim(),
      latitude: form.locationLatitude,
      longitude: form.locationLongitude,
    });

    uni.showToast({
      title: editId.value ? "修改已保存" : "散人约球已发布",
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
    if (!editId.value && await guardReviewMode()) return;
    reviewGateReady.value = true;
  }
  await ensureSessionReady();
  try { await loadEditForm(); } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "加载比赛失败，请返回重试", icon: "none" });
  }
});
usePageRefresh(() => refreshSessionContext());
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view v-if="reviewGateReady" class="app-theme-scope individual-create-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader :title="editId ? '修改散人约球' : '散人约球'" showBack />

    <view class="create-page-content">
      <view class="create-intro">
        <view class="create-intro__label">
          <image class="create-intro__icon" src="/static/icons/lucide/trophy.png" mode="aspectFit" aria-hidden="true" />
          <text class="create-intro__tag">公开约球</text>
        </view>
        <text class="create-intro__copy">{{ heroCopy }}</text>
      </view>

      <view class="form-section">
        <view class="form-section__head">
          <view class="form-section__mark">
            <image class="form-section__icon" src="/static/icons/lucide/users.png" mode="aspectFit" aria-hidden="true" />
          </view>
          <view class="form-section__copy">
            <text class="form-section__title">约球信息</text>
            <text class="form-section__caption">起个好找的标题，确定人数</text>
          </view>
        </view>
        <view class="form-field">
          <text class="form-label">约球标题 <text class="form-required">必填</text></text>
          <input v-model="form.title" class="form-input" maxlength="60" placeholder="例如：周三晚 8 人制散人局" placeholder-class="form-placeholder" />
        </view>
        <view class="form-grid">
          <view class="form-field">
            <text class="form-label">比赛人制</text>
            <view class="form-number">
              <input v-model="form.playersPerTeam" class="form-number__input" type="number" placeholder="8" placeholder-class="form-placeholder" />
              <text class="form-number__unit">人 / 队</text>
            </view>
          </view>
          <view class="form-field">
            <text class="form-label">报名上限 <text class="form-optional">可选</text></text>
            <view class="form-number">
              <input v-model="form.maxPlayers" class="form-number__input" type="number" :placeholder="`${defaultMaxPlayers}`" placeholder-class="form-placeholder" />
              <text class="form-number__unit">人</text>
            </view>
          </view>
        </view>
        <text v-if="playerCountValid" class="form-summary">
          {{ defaultMinPlayers }} 人可开踢 · 最多 {{ form.maxPlayers || defaultMaxPlayers }} 人报名
        </text>
      </view>

      <view class="form-section">
        <view class="form-section__head">
          <view class="form-section__mark">
            <image class="form-section__icon" src="/static/icons/lucide/clock.png" mode="aspectFit" aria-hidden="true" />
          </view>
          <view class="form-section__copy">
            <text class="form-section__title">比赛时间</text>
            <text class="form-section__caption">先选日期，再定开踢和结束时间</text>
          </view>
        </view>
        <MatchScheduleFields
          compact
          :holding-date="holdingDate"
          :match-end-time="matchEndTime"
          :time-valid-message="timeValidMessage"
          @update:holding-date="holdingDate = $event"
          @update:match-end-time="matchEndTime = $event"
        />
      </view>

      <view class="form-section">
        <view class="form-section__head">
          <view class="form-section__mark">
            <image class="form-section__icon" src="/static/icons/lucide/map-pin.png" mode="aspectFit" aria-hidden="true" />
          </view>
          <view class="form-section__copy">
            <text class="form-section__title">场地与报名</text>
            <text class="form-section__caption">选择场地与费用方式</text>
          </view>
        </view>
        <view class="form-field">
          <text class="form-label">球场或地点 <text class="form-required">必填</text></text>
          <IndividualVenueField
            v-model="form.location"
            :venues="venueOptions"
            :selected-from-map="form.locationLatitude != null && form.locationLongitude != null"
            @focus="handleVenueFocus"
            @manual-input="handleLocationInput"
            @select="handleVenueSelected"
            @choose-location="handleChooseLocation"
          />
        </view>
        <view class="form-field">
          <text class="form-label">预计费用</text>
          <view class="fee-options">
            <button v-for="option in feeOptions" :key="option.value" class="fee-option" :class="{ 'fee-option--selected': form.feeType === option.value }" @tap="selectFeeType(option.value)">
              <image class="fee-option__icon" :src="`/static/icons/lucide/${option.icon}.png`" mode="aspectFit" />
              <text>{{ option.label }}</text>
            </button>
          </view>
          <text v-if="form.feeType !== 'fixed_amount'" class="form-caption">{{ form.feeType === 'offline_aa' ? '费用由参与者线下分摊，具体金额由组织者结算。' : '球员免费参加，无需支付报名费。' }}</text>
        </view>
        <template v-if="form.feeType === 'fixed_amount'">
          <view class="form-field">
            <text class="form-label">人均金额 <text class="form-required">必填</text></text>
            <view class="form-number">
              <input v-model="form.feePerPerson" class="form-number__input" type="digit" placeholder="请输入金额" placeholder-class="form-placeholder" />
              <text class="form-number__unit">元 / 人</text>
            </view>
          </view>
          <view class="form-field">
            <text class="form-label">支付方式</text>
            <SegmentedControl :model-value="form.paymentMode" :options="paymentModeOptions" @change="handlePaymentModeChange" />
            <text class="form-caption">{{ paymentModeCaption }}</text>
          </view>
        </template>
        <view class="form-field">
          <text class="form-label">补充说明 <text class="form-optional">可选</text></text>
          <textarea
            v-model="form.note"
            class="form-textarea"
            maxlength="200"
            placeholder="例如：集合时间、停车信息或踢球要求"
            placeholder-class="form-placeholder"
            :adjust-position="true"
            :cursor-spacing="120"
            :show-confirm-bar="false"
          />
        </view>
      </view>

      <view class="create-submit">
        <text class="create-submit__hint">{{ submitHint }}</text>
        <view class="create-submit__button">
          <AppButton block :variant="canSubmit || submitting ? 'lime' : 'muted'" :disabled="!canSubmit" :loading="submitting" @click="handleSubmit">
            {{ submitting ? "保存中..." : editId ? "保存修改" : "发布散人约球" }}
          </AppButton>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.individual-create-page {
  min-height: 100vh;
  padding: 0 28rpx calc(44rpx + env(safe-area-inset-bottom));
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.create-page-content {
  width: 100%;
  max-width: 900rpx;
  margin: 0 auto;
  box-sizing: border-box;
}

.create-intro {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 20rpx;
  padding: 20rpx 24rpx;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-accent-soft);
}

.create-intro__label {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.create-intro__icon {
  width: 26rpx;
  height: 26rpx;
  flex-shrink: 0;
  filter: var(--ui-primitive-icon-filter, none);
}

.create-intro__tag {
  color: var(--ui-color-accent-deep);
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.3;
}

.create-intro__copy {
  color: var(--ui-color-text);
  font-size: 24rpx;
  line-height: 1.5;
}

.form-section {
  margin-top: 18rpx;
  padding: 26rpx 24rpx 28rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-sizing: border-box;
}

.form-section__head {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
}

.form-section__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 48rpx;
  height: 48rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-accent-soft);
}

.form-section__icon {
  width: 28rpx;
  height: 28rpx;
  filter: var(--ui-primitive-icon-filter, none);
}

.form-section__copy {
  min-width: 0;
}

.form-section__title,
.form-section__caption {
  display: block;
}

.form-section__title {
  color: var(--ui-color-text);
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.3;
}

.form-section__caption {
  margin-top: 2rpx;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  line-height: 1.45;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16rpx;
}

.form-field {
  margin-top: 24rpx;
}

.form-label {
  display: block;
  margin-bottom: 12rpx;
  color: var(--ui-color-text);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.35;
}

.form-required,
.form-optional {
  margin-left: 8rpx;
  font-size: 20rpx;
  font-weight: 400;
}

.form-required { color: var(--ui-color-accent-deep); }
.form-optional { color: var(--ui-color-text-muted); }

.form-summary {
  display: block;
  margin-top: 20rpx;
  padding: 14rpx 18rpx;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-accent-soft);
  color: var(--ui-color-text);
  font-size: 22rpx;
  line-height: 1.45;
}

.form-caption {
  display: block;
  margin-top: 12rpx;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  line-height: 1.5;
}

.form-input,
.form-textarea,
.form-number {
  width: 100%;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  font-size: 28rpx;
  box-sizing: border-box;
}

.form-input {
  height: 80rpx;
  padding: 0 20rpx;
}

.form-number {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 80rpx;
  padding: 0 16rpx 0 20rpx;
}

.form-number__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  color: var(--ui-color-text);
  font-size: 28rpx;
}

.form-number__unit {
  flex-shrink: 0;
  margin-left: 6rpx;
  color: var(--ui-color-text-muted);
  font-size: 20rpx;
  white-space: nowrap;
}

.form-placeholder {
  color: var(--ui-color-text-disabled);
  font-size: 24rpx;
}

.form-textarea {
  min-height: 138rpx;
  padding: 20rpx;
  line-height: 1.5;
}

.create-submit {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14rpx;
  margin-top: 28rpx;
  padding: 0 2rpx;
}

.create-submit__hint {
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  line-height: 1.45;
  text-align: center;
}

.create-submit__button {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.fee-options { display: flex; gap: 12rpx; }
.fee-option { flex: 1; min-width: 0; margin: 0; padding: 24rpx 8rpx; display: flex; flex-direction: column; align-items: center; gap: 12rpx; font-size: 26rpx; line-height: 1.4; border: var(--ui-border-default); border-radius: var(--ui-radius-button); color: var(--ui-color-text); background: var(--ui-color-surface); }
.fee-option::after { border: 0; }
.fee-option--selected { border-color: var(--ui-color-accent); background: var(--ui-color-accent-soft); font-weight: 600; }
.fee-option__icon { width: 36rpx; height: 36rpx; }
</style>
