<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import ActivitiesSkeleton from "./components/ActivitiesSkeleton.vue";
import ActivitiesToolbar from "./components/ActivitiesToolbar.vue";
import type { ActivityQuickFilter } from "./components/ActivitiesToolbar.vue";
import ChallengeHallSections from "./components/ChallengeHallSections.vue";
import PublishTypeSheet from "./components/PublishTypeSheet.vue";
import { acceptChallenge, cancelIndividualChallengeAcceptance, listChallenges } from "@/api/challenge";
import { useMiniReviewStatus } from "@/stores/miniReview";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";
import { getAccessToken } from "@/utils/authStorage";
import { DEFAULT_SHARE_IMAGE_URL } from "@/utils/share";
import type { BackendChallenge, BackendChallengeSummary, BackendChallengeStatus } from "@/types/backend";
import type { ChallengeCardViewModel } from "@/types/viewModels";
import { buildChallengeCards, filterChallengeSummariesByScope } from "@/utils/viewModels";

type ChallengeScope = "all" | "open" | "mine";
type ChallengeSort = "holding_date_asc" | "holding_date_desc" | "created_at_desc" | "credit_desc";
type ChallengeStatusFilter = "all" | BackendChallengeStatus;
type QuickFilter = ActivityQuickFilter;

const { currentIdentity, currentTeam, ensureSessionReady } = useTeamContext();
const { shouldHideCreationEntrances } = useMiniReviewStatus();
const { syncUnreadCount } = useNotificationCenter();
const navMetrics = getCustomNavMetrics();

const isLoading = ref(false);
const isRefreshing = ref(false);
const hasLoadedOnce = ref(false);
const errorMessage = ref("");
const submitting = ref(false);
const rawChallenges = ref<BackendChallengeSummary[]>([]);
const publishTypeSheetVisible = ref(false);
const searchDraft = ref("");
const activeQuickFilter = ref<QuickFilter>("recommended");
const selectedDateKey = ref("");

const filters = reactive<{
  keyword: string;
  status: ChallengeStatusFilter;
  sort: ChallengeSort;
  includeClosed: boolean;
}>({
  keyword: "",
  status: "all",
  sort: "credit_desc",
  includeClosed: false,
});

const canPublish = computed(() => !!currentIdentity.value && !shouldHideCreationEntrances.value);
const quickFilters: Array<{ key: QuickFilter; label: string }> = [
  { key: "recommended", label: "推荐" },
  { key: "team", label: "球队约队" },
  { key: "individual", label: "散人约队" },
  { key: "mine", label: "我相关" },
  { key: "open", label: "待接约" },
  { key: "eight", label: "8 人制" },
  { key: "five", label: "5 人制" },
];

const isLogoutBlockedError = computed(() => errorMessage.value.includes("已退出登录"));
const isGuestMode = computed(() => !getAccessToken());
const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function extractDateKey(isoText: string) {
  return isoText.replace("T", " ").slice(0, 10);
}

function weekdayLabel(key: string) {
  const date = new Date(`${key}T00:00:00`);
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()] ?? "待定";
}

function monthDayNumber(key: string) {
  const date = new Date(`${key}T00:00:00`);
  return String(date.getDate()).padStart(2, "0");
}

const calendarDays = computed(() => {
  const base = new Date(`${todayKey()}T00:00:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return {
      key,
      badgeLabel: index === 0 ? "今天" : weekdayLabel(key),
      dayNumber: monthDayNumber(key),
      matchCount: rawChallenges.value.filter((item) => extractDateKey(item.challenge.holding_date) === key).length,
    };
  });
});

function quickFilterScope(filter: QuickFilter): ChallengeScope {
  if (filter === "mine") return "mine";
  if (filter === "open") return "open";
  return "all";
}

const filteredSummaries = computed(() => {
  let summaries = filterChallengeSummariesByScope(rawChallenges.value, quickFilterScope(activeQuickFilter.value));

  if (activeQuickFilter.value === "team") {
    summaries = summaries.filter((item) => item.challenge.kind === "team");
  }

  if (activeQuickFilter.value === "individual") {
    summaries = summaries.filter((item) => item.challenge.kind === "individual");
  }

  if (activeQuickFilter.value === "eight") {
    summaries = summaries.filter((item) => item.challenge.players_per_team === 8);
  }

  if (activeQuickFilter.value === "five") {
    summaries = summaries.filter((item) => item.challenge.players_per_team === 5);
  }

  if (selectedDateKey.value) {
    summaries = summaries.filter((item) => extractDateKey(item.challenge.holding_date) === selectedDateKey.value);
  }

  return summaries;
});

const hallCards = computed<ChallengeCardViewModel[]>(() => buildChallengeCards(filteredSummaries.value));
const teamHallCards = computed(() => hallCards.value.filter((item) => item.kind === "team"));
const individualHallCards = computed(() => hallCards.value.filter((item) => item.kind === "individual"));
const shareTitle = "约队大厅：看看可报名的散人局";
const sharePath = "/pages/activities/index";

function ensureSelectedDate(challenges: BackendChallengeSummary[]) {
  const nextSevenKeys = calendarDays.value.map((item) => item.key);
  const matchedKey = challenges
    .map((item) => extractDateKey(item.challenge.holding_date))
    .find((key) => nextSevenKeys.includes(key));

  if (!selectedDateKey.value || !nextSevenKeys.includes(selectedDateKey.value)) {
    selectedDateKey.value = matchedKey ?? nextSevenKeys[0] ?? todayKey();
  }
}

async function loadPageData(options?: { preserveContent?: boolean }) {
  const preserveContent = !!options?.preserveContent && hasLoadedOnce.value;

  if (preserveContent) {
    isRefreshing.value = true;
  } else {
    isLoading.value = true;
  }
  errorMessage.value = "";

  try {
    if (!isGuestMode.value) {
      await ensureSessionReady();
    }

    const challenges = await listChallenges({
      teamId: isGuestMode.value ? undefined : currentTeam.value?.id,
      keyword: filters.keyword || undefined,
      status: filters.status === "all" ? undefined : filters.status,
      includeClosed: filters.includeClosed,
      limit: 50,
      sort: filters.sort,
      auth: !isGuestMode.value,
    });

    if (!isGuestMode.value) {
      void syncUnreadCount({ skipEnsure: true }).catch(() => {
        // 未读数不影响约队大厅公开内容展示。
      });
    }

    rawChallenges.value = challenges;
    ensureSelectedDate(challenges);
    hasLoadedOnce.value = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "约队大厅加载失败";
    errorMessage.value = message.includes("已退出登录") ? "" : message;
  } finally {
    if (preserveContent) {
      isRefreshing.value = false;
    } else {
      isLoading.value = false;
    }
  }
}

async function requireLoginForHallAction() {
  if (!isGuestMode.value) return true;

  try {
    await ensureSessionReady(true);
    return true;
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "登录失败",
      icon: "none",
    });
    return false;
  }
}

function applySearch() {
  filters.keyword = searchDraft.value.trim();
  void loadPageData();
}

function applyQuickFilter(filter: QuickFilter) {
  activeQuickFilter.value = filter;
  if (filter === "recommended" && filters.sort !== "credit_desc") {
    filters.sort = "credit_desc";
    void loadPageData();
  }
}

function selectDate(key: string) {
  selectedDateKey.value = key;
}

async function openPublishTypeSheet() {
  if (isGuestMode.value) {
    const loggedIn = await requireLoginForHallAction();
    if (!loggedIn) return;
    await loadPageData({ preserveContent: true });
  }

  if (!canPublish.value) {
    uni.showToast({
      title: "请先在我的页面选择球队或场馆身份",
      icon: "none",
    });
    return;
  }
  publishTypeSheetVisible.value = true;
}

function closePublishTypeSheet() {
  publishTypeSheetVisible.value = false;
}

function handlePublishTeamChallenge() {
  closePublishTypeSheet();
  uni.navigateTo({
    url: "/pages/challenges/create-individual/index?kind=team",
  });
}

function handlePublishIndividualChallenge() {
  closePublishTypeSheet();
  uni.navigateTo({
    url: "/pages/challenges/create-individual/index",
  });
}

function openChallengeDetail(challengeId: string) {
  uni.navigateTo({
    url: `/pages/challenges/detail?id=${challengeId}`,
  });
}

function openChallengeCardDetail(card: ChallengeCardViewModel) {
  openChallengeDetail(card.id);
}

function openMatchDetail(activityId: string) {
  uni.navigateTo({
    url: `/pages/matches/detail?id=${activityId}`,
  });
}

function applyAcceptedChallengeState(challenge: BackendChallenge, card: ChallengeCardViewModel) {
  rawChallenges.value = rawChallenges.value.map((summary) => {
    if (summary.challenge.id !== challenge.id) return summary;

    const isIndividual = challenge.kind === "individual";
    const isTeamReservedByCurrentTeam =
      !isIndividual &&
      challenge.status === "open" &&
      challenge.host_team_id === currentTeam.value?.id &&
      !challenge.guest_team_id;
    return {
      ...summary,
      challenge,
      host_team_name: isTeamReservedByCurrentTeam ? currentTeam.value?.name ?? summary.host_team_name : summary.host_team_name,
      host_team_credit_score: isTeamReservedByCurrentTeam ? currentTeam.value?.creditScore ?? summary.host_team_credit_score : summary.host_team_credit_score,
      host_team_trust_label: isTeamReservedByCurrentTeam ? currentTeam.value?.trustLabel ?? summary.host_team_trust_label : summary.host_team_trust_label,
      guest_team_name: isIndividual || isTeamReservedByCurrentTeam ? summary.guest_team_name : currentTeam.value?.name ?? summary.guest_team_name,
      guest_team_credit_score: isIndividual || isTeamReservedByCurrentTeam ? summary.guest_team_credit_score : currentTeam.value?.creditScore ?? summary.guest_team_credit_score,
      guest_team_trust_label: isIndividual || isTeamReservedByCurrentTeam ? summary.guest_team_trust_label : currentTeam.value?.trustLabel ?? summary.guest_team_trust_label,
      current_team_relation: isIndividual ? summary.current_team_relation : isTeamReservedByCurrentTeam ? "host" : "guest",
      accepted_count: isIndividual ? summary.accepted_count + 1 : summary.accepted_count,
      current_user_joined: isIndividual ? true : summary.current_user_joined,
      can_accept: false,
    };
  });

  if (challenge.activity_id && challenge.status === "matched") {
    openMatchDetail(challenge.activity_id);
    return;
  }

  if (!isIndividualChallenge(card)) {
    syncUnreadCount({ skipEnsure: true });
  }
}

function applyCancelledIndividualChallengeState(challenge: BackendChallenge) {
  rawChallenges.value = rawChallenges.value.map((summary) => {
    if (summary.challenge.id !== challenge.id) return summary;

    return {
      ...summary,
      challenge,
      accepted_count: Math.max(summary.accepted_count - 1, 0),
      current_user_joined: false,
      can_accept: challenge.status === "open",
    };
  });
}

function isIndividualChallenge(card: ChallengeCardViewModel) {
  return card.kind === "individual";
}

function prependCreatedChallenge(challenge: BackendChallenge) {
  const hostTeam = currentTeam.value;
  const summary: BackendChallengeSummary = {
    challenge,
    host_team_name: hostTeam?.name ?? "当前球队",
    host_team_credit_score: hostTeam?.creditScore ?? 0,
    host_team_trust_label: hostTeam?.trustLabel ?? "信用待评",
    guest_team_name: null,
    guest_team_credit_score: null,
    guest_team_trust_label: null,
    current_team_relation: "host",
    accepted_count: 0,
    current_user_joined: false,
    can_accept: false,
  };

  rawChallenges.value = [summary, ...rawChallenges.value.filter((item) => item.challenge.id !== challenge.id)];
  ensureSelectedDate(rawChallenges.value);
}

async function handlePrimaryAction(card: ChallengeCardViewModel) {
  if (card.activityId && card.statusTone === "matched") {
    openMatchDetail(card.activityId);
    return;
  }

  if (card.kind === "individual" && card.currentUserJoined) {
    await handleCancelIndividualAcceptance(card);
    return;
  }

  if (card.kind === "individual" && card.statusTone === "open") {
    await handleAccept(card);
    return;
  }

  if (card.canAccept) {
    await handleAccept(card);
    return;
  }

  openChallengeDetail(card.id);
}

async function handleCancelIndividualAcceptance(card: ChallengeCardViewModel) {
  if (submitting.value || card.kind !== "individual" || !card.currentUserJoined) return;
  const loggedIn = await requireLoginForHallAction();
  if (!loggedIn) return;

  uni.showModal({
    title: "确认取消报名",
    content: `确认取消「${card.title}」的报名？取消后可重新报名。`,
    confirmText: "取消报名",
    cancelText: "再想想",
    success: async (result) => {
      if (!result.confirm) return;
      submitting.value = true;
      try {
        const challenge = await cancelIndividualChallengeAcceptance(card.id);
        applyCancelledIndividualChallengeState(challenge);
        uni.showToast({
          title: "已取消报名",
          icon: "none",
        });
      } catch (error) {
        uni.showToast({
          title: error instanceof Error ? error.message : "取消报名失败",
          icon: "none",
        });
      } finally {
        submitting.value = false;
      }
    },
  });
}

async function handleAccept(card: ChallengeCardViewModel) {
  if (submitting.value) return;
  const loggedIn = await requireLoginForHallAction();
  if (!loggedIn) return;
  if (card.kind === "team" && (!currentTeam.value || !currentTeam.value.canManageTeam)) return;

  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: card.kind === "team" ? "确认接约" : "确认报名",
      content:
        card.kind === "team"
          ? `确认以当前球队接约「${card.title}」？`
          : `确认报名参加「${card.title}」？`,
      confirmText: card.kind === "team" ? "确认接约" : "确认报名",
      cancelText: "再想想",
      success: (result) => resolve(!!result.confirm),
      fail: () => resolve(false),
    });
  });
  if (!confirmed) return;

  submitting.value = true;
  try {
    const challenge = await acceptChallenge(card.id, card.kind === "team" ? currentTeam.value?.id : undefined);
    applyAcceptedChallengeState(challenge, card);
    uni.showToast({
      title: card.kind === "team" ? "接约成功" : "报名成功",
      icon: "none",
    });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "接约失败",
      icon: "none",
    });
  } finally {
    submitting.value = false;
  }
}

onShow(() => {
  uni.hideTabBar({ animation: false });
  void loadPageData({ preserveContent: hasLoadedOnce.value });
});

onShareAppMessage(() => ({
  title: shareTitle,
  path: sharePath,
  imageUrl: DEFAULT_SHARE_IMAGE_URL,
}));

onShareTimeline(() => ({
  title: shareTitle,
  query: "",
  imageUrl: DEFAULT_SHARE_IMAGE_URL,
}));
</script>

<template>
  <view class="hall-page" :style="pageStyle">
    <AppTabHeader title="约队大厅" plain />

    <view v-if="isRefreshing" class="hall-refresh-mask">
      <view class="hall-refresh-chip">更新中...</view>
    </view>

    <view v-if="errorMessage && !isLogoutBlockedError" class="hall-empty">{{ errorMessage }}</view>
    <ActivitiesSkeleton v-else-if="isLoading" />

    <template v-else>
    <ActivitiesToolbar
      v-model:search-draft="searchDraft"
      :quick-filters="quickFilters"
      :active-quick-filter="activeQuickFilter"
      :calendar-days="calendarDays"
      :selected-date-key="selectedDateKey"
      :can-publish="canPublish"
      @search="applySearch"
      @quick-filter="applyQuickFilter"
      @select-date="selectDate"
      @open-publish="openPublishTypeSheet"
    />

    <PublishTypeSheet
      :visible="publishTypeSheetVisible"
      @close="closePublishTypeSheet"
      @publish-team="handlePublishTeamChallenge"
      @publish-individual="handlePublishIndividualChallenge"
    />

    <ChallengeHallSections
      v-if="hallCards.length"
      :team-hall-cards="teamHallCards"
      :individual-hall-cards="individualHallCards"
      :submitting="submitting"
      @open-challenge-detail="openChallengeCardDetail"
      @primary-action="handlePrimaryAction"
    />

    <view v-else class="hall-empty hall-empty-spacious">
      当前筛选条件下还没有约队记录，可以切换日期或标签再看看。
    </view>
    </template>

    <BottomTabBar current="challenge" />
  </view>
</template>

<style scoped>
.hall-page {
  position: relative;
  min-height: 100vh;
  padding: calc(env(safe-area-inset-top) + 36rpx) 28rpx 164rpx;
  background:
    radial-gradient(circle at top right, rgba(200, 255, 0, 0.14), transparent 28%),
    linear-gradient(180deg, #ffffff 0%, #f5f6f2 100%);
  box-sizing: border-box;
}

.hall-refresh-mask {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 104rpx);
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.hall-refresh-chip {
  padding: 12rpx 22rpx;
  border-radius: 999rpx;
  background: rgba(17, 19, 16, 0.86);
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 800;
  box-shadow: 0 14rpx 30rpx rgba(17, 19, 16, 0.16);
}

.hall-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.hall-title {
  display: block;
  font-size: 64rpx;
  font-weight: 900;
  letter-spacing: -2rpx;
  color: #111111;
}

.hall-subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #6c6f66;
}

.hall-header-badge {
  padding: 14rpx 22rpx;
  border-radius: 999rpx;
  background: #111111;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 700;
}

.hall-empty {
  margin-top: 28rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  background: #ffffff;
  color: #6b7068;
  font-size: 28rpx;
  line-height: 1.6;
}

.hall-empty-spacious {
  margin-top: 24rpx;
  margin-bottom: 24rpx;
}

</style>
