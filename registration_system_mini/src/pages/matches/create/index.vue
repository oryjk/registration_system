<script setup lang="ts">
import { usePageRefresh } from "@/composables/usePageRefresh";
import { useAccentTheme } from "@/stores/theme";
import { computed, reactive, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import MatchPublishForm from "./components/MatchPublishForm.vue";
import AppButton from "@/components/ui/AppButton.vue";
import StickyActionBar from "@/components/ui/StickyActionBar.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import type { MatchPublishFormModel } from "./components/matchPublishFormModel";
import { createMatch, getMatchDetail, updateMyMatch, getVenueSuggestions, type BackendVenueSuggestion } from "@/api/match";
import VenuePickerSheet from "./components/VenuePickerSheet.vue";
import { preloadMiniReviewStatus, useMiniReviewStatus } from "@/stores/miniReview";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";
import { buildCreateMatchPayload } from "./createMatchPayload";

const { themePageStyle } = useAccentTheme();

const { currentTeam, ensureSessionReady, refreshSessionContext } = useTeamContext();
const { shouldHideCreationEntrances } = useMiniReviewStatus();
const navMetrics = getCustomNavMetrics();

const submitting = ref(false);
const editId = ref("");
const editReady = ref(false);
const allowedPublicationModes = ref<MatchPublishFormModel["publicationMode"][]>();
const originalMode = ref<MatchPublishFormModel["publicationMode"]>();
const originalPaymentMode = ref<"prepaid" | "postpaid">("postpaid");
onLoad(query => { editId.value = String(query?.editId || ""); });
async function loadEditForm() {
  if (!editId.value || editReady.value) return;
  const detail = await getMatchDetail(editId.value);
  const m = detail.match;
  if (m.host_team_id !== currentTeam.value?.id) throw new Error("请切换到发布球队后修改比赛");
  originalMode.value = m.publication_mode;
  allowedPublicationModes.value = m.publication_mode === "online_team" && m.opponent_state === "recruiting" && !m.away_team_id
    ? ["online_team", "offline_confirmed", "online_individual"] : [m.publication_mode];
  originalPaymentMode.value = m.payment_mode || "postpaid";
  Object.assign(form, {
    name: m.name, location: m.location, locationLatitude: m.location_latitude ?? null,
    locationLongitude: m.location_longitude ?? null,
    holdingDate: new Date(m.start_time).getTime(), matchEndTime: new Date(m.end_time).getTime(),
    opposing: m.opponent_name || "", description: m.description || "",
    playersPerTeam: m.players_per_team,
    hostCapacityLimit: detail.groups.find(g => g.kind === "host_team")?.max_players ?? "",
    color: m.host_color || "", opposingColor: m.away_color || "", publicationMode: m.publication_mode,
    feeType: m.fee_type || ((m.fee_per_person_cents ?? 0) > 0 ? "fixed_amount" : m.is_free ? "free" : "offline_aa"),
    feePerPerson: (m.fee_per_person_cents ?? 0) / 100,
  });
  editReady.value = true;
}
const reviewGateReady = ref(false);
const form = reactive<MatchPublishFormModel>({
  name: "",
  location: "",
  locationLatitude: null as number | null,
  locationLongitude: null as number | null,
  holdingDate: 0,
  matchEndTime: 0,
  opposing: "",
  description: "",
  playersPerTeam: "" as string | number,
  hostCapacityLimit: "" as string | number,
  color: "#D8DDE6",
  opposingColor: "#2F6BFF",
  publicationMode: "offline_confirmed",
  activityMatchKind: "external",
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
    (!editId.value || editReady.value) &&
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
  form.opposing = "";
  form.description = "";
  form.playersPerTeam = 8;
  form.hostCapacityLimit = "";
  form.color = "#D8DDE6";
  form.opposingColor = "#2F6BFF";
  form.publicationMode = "offline_confirmed";
  form.feeType = undefined;
  form.feePerPerson = "";
  form.activityMatchKind = "external";
  form.enableCheckIn = false;
  form.checkInRadiusMeters = 200;
  form.openMinutesBefore = 60;
  form.closeMinutesAfter = 45;
}

function handleLocationInput() {
  form.locationLatitude = null;
  form.locationLongitude = null;
}

// 场地选择弹层：常用场地建议懒加载（首次打开请求一次并缓存）。
const venuePickerVisible = ref(false);
const venueSuggestions = ref<BackendVenueSuggestion[]>([]);
const venueSuggestionsLoading = ref(false);
const venueSuggestionsLoaded = ref(false);

async function loadVenueSuggestions() {
  if (venueSuggestionsLoaded.value || venueSuggestionsLoading.value) return;
  venueSuggestionsLoading.value = true;
  try {
    venueSuggestions.value = await getVenueSuggestions(10);
    venueSuggestionsLoaded.value = true;
  } catch {
    // 建议加载失败不阻塞选场地：弹层仍可手动输入/地图选点。
  } finally {
    venueSuggestionsLoading.value = false;
  }
}

function handleOpenVenuePicker() {
  void loadVenueSuggestions();
  venuePickerVisible.value = true;
}

function handleVenueSelected(venue: BackendVenueSuggestion) {
  form.location = venue.location;
  form.locationLatitude = venue.latitude ?? null;
  form.locationLongitude = venue.longitude ?? null;
  venuePickerVisible.value = false;
}

function handleVenueManualInput(location: string) {
  form.location = location;
  form.locationLatitude = null;
  form.locationLongitude = null;
  venuePickerVisible.value = false;
}

function handleChooseLocation() {
  venuePickerVisible.value = false;
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
  if (!editId.value && await guardReviewMode()) return;

  if (!currentTeam.value || !currentTeam.value.canManageTeam) {
    uni.showToast({
      title: "只有队长或领队可以创建比赛",
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
    const payload = buildCreateMatchPayload(form, currentTeam.value);
    const detail = editId.value ? await updateMyMatch(editId.value, {
      ...payload,
      description: form.description.trim(),
      opponent_name: form.opposing.trim(),
      publication_mode: form.publicationMode === originalMode.value ? undefined : form.publicationMode,
      payment_mode: form.feeType === "fixed_amount" ? originalPaymentMode.value : "postpaid",
      max_players: payload.host_capacity_limit,
    }) : await createMatch(payload);
    uni.$emit("home:data-may-changed");
    const hostGroupId = detail.groups.find((group) => group.team_id === currentTeam.value?.id)?.id ?? detail.groups[0]?.id;
    uni.showToast({
      title: editId.value ? "修改已保存" : "比赛已创建",
      icon: "none",
    });
    uni.redirectTo({
      url: `/pages/matches/detail?id=${detail.match.id}${hostGroupId ? `&groupId=${hostGroupId}` : ""}`,
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
  // 从地图选点等原生页返回会再次触发 onShow；reviewGateReady 已置位时不再重建页面，
  // 否则 v-if 整页卸载重挂会把滚动位置重置回顶部。
  if (!reviewGateReady.value) {
    if (!editId.value && await guardReviewMode()) return;
    reviewGateReady.value = true;
  }
  await ensureSessionReady();
  if (editId.value) {
    try { await loadEditForm(); } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "加载比赛失败，请返回重试", icon: "none" });
    }
  } else if (!form.holdingDate) {
    initDefaultForm();
  }
});
usePageRefresh(() => refreshSessionContext());
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view v-if="reviewGateReady" class="app-theme-scope create-match-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader :title="editId ? '修改比赛' : '创建比赛'" showBack />

    <view class="create-page-content">
      <AppSurface variant="outlined" custom-class="create-hero">
        <view class="create-hero__copy">
          <text class="create-hero-title">{{ currentTeam?.name || "当前球队" }}</text>
        </view>
        <view class="create-hero__mark">
          <image
            v-if="currentTeam?.logoUrl"
            class="create-hero__logo"
            :src="currentTeam.logoUrl"
            mode="aspectFill"
          />
          <text v-else>{{ (currentTeam?.name || "队").slice(0, 1) }}</text>
        </view>
      </AppSurface>

      <MatchPublishForm
        :model-value="form"
        mode="match"
        :show-check-in="false"
        :allowed-publication-modes="allowedPublicationModes"
        :time-valid-message="timeValidMessage"
        @location-input="handleLocationInput"
        @choose-location="handleChooseLocation"
        @open-venue-picker="handleOpenVenuePicker"
      />
    </view>

    <VenuePickerSheet
      :visible="venuePickerVisible"
      :suggestions="venueSuggestions"
      :loading="venueSuggestionsLoading"
      :current-location="form.location"
      @close="venuePickerVisible = false"
      @select="handleVenueSelected"
      @manual-input="handleVenueManualInput"
      @choose-location="handleChooseLocation"
    />

    <StickyActionBar>
      <AppButton block variant="lime" :disabled="!canSubmit" :loading="submitting" @click="handleSubmit">
        {{ submitting ? "保存中..." : editId ? "保存修改" : "创建比赛" }}
      </AppButton>
    </StickyActionBar>
  </view>
</template>

<style scoped>
.create-match-page {
  min-height: 100vh;
  /* 底部留白用操作栏 clearance token：含悬浮操作栏高度与全面屏安全区，硬编码 132rpx 会被按钮遮挡。 */
  padding: 0 28rpx var(--ui-action-bar-clearance);
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.create-page-content {
  max-width: 900rpx;
  margin: 0 auto;
}

.create-hero {
  display: flex;
  align-items: center;
  gap: 22rpx;
  margin: 0 0 20rpx;
  padding: 28rpx 26rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-shadow: none;
}

.create-hero__copy {
  flex: 1;
  min-width: 0;
}

.create-hero-title {
  display: block;
  color: var(--ui-color-text);
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.18;
  word-break: break-word;
}

.create-hero__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  border: none;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text);
  font-size: 30rpx;
  font-weight: 600;
  overflow: hidden;
}

.create-hero__logo {
  width: 100%;
  height: 100%;
}

</style>
