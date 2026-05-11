<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import { acceptChallenge, listChallenges } from "@/api/challenge";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";
import type { BackendChallenge, BackendChallengeSummary, BackendChallengeStatus } from "@/types/backend";
import type { ChallengeCardViewModel } from "@/types/viewModels";
import { buildChallengeCards, filterChallengeSummariesByScope } from "@/utils/viewModels";

type ChallengeScope = "all" | "open" | "mine";
type ChallengeSort = "holding_date_asc" | "holding_date_desc" | "created_at_desc" | "credit_desc";
type ChallengeStatusFilter = "all" | BackendChallengeStatus;
type QuickFilter = "recommended" | "mine" | "open" | "eight" | "five";

const { currentTeam, ensureSessionReady } = useTeamContext();
const { syncUnreadCount } = useNotificationCenter();
const navMetrics = getCustomNavMetrics();

const isLoading = ref(false);
const errorMessage = ref("");
const submitting = ref(false);
const rawChallenges = ref<BackendChallengeSummary[]>([]);
const showFilterPanel = ref(false);
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

const canPublish = computed(() => !!currentTeam.value?.canManageTeam);
const statusOptions: Array<{ label: string; value: ChallengeStatusFilter }> = [
  { label: "全部状态", value: "all" },
  { label: "待接约", value: "open" },
  { label: "已约成", value: "matched" },
  { label: "已取消", value: "cancelled" },
];

const sortOptions: Array<{ label: string; value: ChallengeSort }> = [
  { label: "智能排序", value: "credit_desc" },
  { label: "开球时间优先", value: "holding_date_asc" },
  { label: "时间倒序", value: "holding_date_desc" },
  { label: "最新发布", value: "created_at_desc" },
];

const quickFilters: Array<{ key: QuickFilter; label: string }> = [
  { key: "recommended", label: "推荐" },
  { key: "mine", label: "我相关" },
  { key: "open", label: "待接约" },
  { key: "eight", label: "8 人制" },
  { key: "five", label: "5 人制" },
];

const activeSortLabel = computed(
  () => sortOptions.find((item) => item.value === filters.sort)?.label ?? sortOptions[0].label,
);
const activeStatusLabel = computed(
  () => statusOptions.find((item) => item.value === filters.status)?.label ?? statusOptions[0].label,
);
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
const openCount = computed(() => rawChallenges.value.filter((item) => item.challenge.status === "open").length);
const mineCount = computed(
  () => rawChallenges.value.filter((item) => item.current_team_relation && item.current_team_relation !== "viewer").length,
);

function ensureSelectedDate(challenges: BackendChallengeSummary[]) {
  const nextSevenKeys = calendarDays.value.map((item) => item.key);
  const matchedKey = challenges
    .map((item) => extractDateKey(item.challenge.holding_date))
    .find((key) => nextSevenKeys.includes(key));

  if (!selectedDateKey.value || !nextSevenKeys.includes(selectedDateKey.value)) {
    selectedDateKey.value = matchedKey ?? nextSevenKeys[0] ?? todayKey();
  }
}

async function loadPageData() {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    await ensureSessionReady();
    if (!currentTeam.value) {
      rawChallenges.value = [];
      return;
    }

    const [challenges] = await Promise.all([
      listChallenges({
        teamId: currentTeam.value.id,
        keyword: filters.keyword || undefined,
        status: filters.status === "all" ? undefined : filters.status,
        includeClosed: filters.includeClosed,
        limit: 50,
        sort: filters.sort,
      }),
      syncUnreadCount({ skipEnsure: true }),
    ]);

    rawChallenges.value = challenges;
    ensureSelectedDate(challenges);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "约队大厅加载失败";
  } finally {
    isLoading.value = false;
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

function openSortSheet() {
  uni.showActionSheet({
    itemList: sortOptions.map((item) => item.label),
    success: ({ tapIndex }) => {
      const option = sortOptions[tapIndex];
      if (!option) return;
      filters.sort = option.value;
      void loadPageData();
    },
  });
}

function openStatusSheet() {
  uni.showActionSheet({
    itemList: statusOptions.map((item) => item.label),
    success: ({ tapIndex }) => {
      const option = statusOptions[tapIndex];
      if (!option) return;
      filters.status = option.value;
      void loadPageData();
    },
  });
}

function openPublishTypeSheet() {
  if (!canPublish.value) return;
  publishTypeSheetVisible.value = true;
}

function closePublishTypeSheet() {
  publishTypeSheetVisible.value = false;
}

function handlePublishTeamChallenge() {
  closePublishTypeSheet();
  uni.navigateTo({
    url: "/pages/matches/create/index",
  });
}

function handlePublishIndividualChallenge() {
  closePublishTypeSheet();
  uni.navigateTo({
    url: "/pages/challenges/create-individual/index",
  });
}

function toggleIncludeClosed() {
  filters.includeClosed = !filters.includeClosed;
  void loadPageData();
}

function openChallengeDetail(challengeId: string) {
  uni.navigateTo({
    url: `/pages/challenges/detail?id=${challengeId}`,
  });
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
    return {
      ...summary,
      challenge,
      guest_team_name: isIndividual ? summary.guest_team_name : currentTeam.value?.name ?? summary.guest_team_name,
      guest_team_credit_score: isIndividual ? summary.guest_team_credit_score : currentTeam.value?.creditScore ?? summary.guest_team_credit_score,
      guest_team_trust_label: isIndividual ? summary.guest_team_trust_label : currentTeam.value?.trustLabel ?? summary.guest_team_trust_label,
      current_team_relation: isIndividual ? summary.current_team_relation : "guest",
      accepted_count: isIndividual ? summary.accepted_count + 1 : summary.accepted_count,
      current_user_joined: isIndividual ? true : summary.current_user_joined,
      can_accept: false,
    };
  });

  if (challenge.activity_id) {
    openMatchDetail(challenge.activity_id);
    return;
  }

  if (!isIndividualChallenge(card)) {
    syncUnreadCount({ skipEnsure: true });
  }
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
  if (card.activityId) {
    openMatchDetail(card.activityId);
    return;
  }

  if (card.canAccept) {
    await handleAccept(card);
    return;
  }

  openChallengeDetail(card.id);
}

async function handleAccept(card: ChallengeCardViewModel) {
  if (submitting.value) return;
  if (card.kind === "team" && (!currentTeam.value || !currentTeam.value.canManageTeam)) return;

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
  void loadPageData();
});
</script>

<template>
  <view class="hall-page" :style="pageStyle">
    <AppTabHeader title="约队大厅" />

    <view v-if="errorMessage" class="hall-empty">{{ errorMessage }}</view>
    <view v-else-if="isLoading" class="hall-empty">正在加载约队大厅...</view>

    <view class="hall-toolbar">
      <view class="hall-search">
        <text class="hall-search-icon">搜</text>
        <input
          v-model="searchDraft"
          class="hall-search-input"
          placeholder="搜索球队 / 场地 / 比赛"
          confirm-type="search"
          @confirm="applySearch"
        />
      </view>
      <view
        :class="['hall-publish-button', !canPublish ? 'hall-publish-button-disabled' : '']"
        @tap="openPublishTypeSheet"
      >
        发布约队
      </view>
    </view>

    <view class="hall-quick-filters">
      <view
        v-for="item in quickFilters"
        :key="item.key"
        :class="['hall-quick-chip', activeQuickFilter === item.key ? 'hall-quick-chip-active' : '']"
        @tap="applyQuickFilter(item.key)"
      >
        {{ item.label }}
      </view>
    </view>

    <scroll-view class="hall-date-strip" scroll-x>
      <view class="hall-date-strip-inner">
        <view
          v-for="item in calendarDays"
          :key="item.key"
          :class="['hall-date-pill', selectedDateKey === item.key ? 'hall-date-pill-active' : '']"
          @tap="selectDate(item.key)"
        >
          <text class="hall-date-week">{{ item.badgeLabel }}</text>
          <text class="hall-date-number">{{ item.dayNumber }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="hall-filter-bar">
      <view class="hall-filter-action" @tap="openSortSheet">
        <text>{{ activeSortLabel }}</text>
      </view>
      <view class="hall-filter-action" @tap="openStatusSheet">
        <text>{{ activeStatusLabel }}</text>
      </view>
      <view class="hall-filter-action hall-filter-action-strong" @tap="showFilterPanel = !showFilterPanel">
        <text>{{ showFilterPanel ? "收起筛选" : "筛选" }}</text>
      </view>
    </view>

    <view v-if="showFilterPanel" class="hall-panel">
      <view class="hall-panel-head">
        <view>
          <view class="hall-panel-title">更多筛选</view>
          <view class="hall-panel-caption">当前球队相关 {{ mineCount }} 条，待接约 {{ openCount }} 条。</view>
        </view>
      </view>
      <view class="hall-filter-switch-row">
        <text class="hall-filter-switch-label">包含已取消约队</text>
        <switch :checked="filters.includeClosed" color="#c8ff00" @change="toggleIncludeClosed" />
      </view>
    </view>

    <view v-if="publishTypeSheetVisible" class="publish-sheet-overlay" @tap="closePublishTypeSheet">
      <view class="publish-sheet" @tap.stop>
        <view class="publish-sheet-header">
          <view class="publish-sheet-title">发布约队</view>
          <view class="publish-sheet-close" @tap="closePublishTypeSheet">×</view>
        </view>

        <view class="publish-sheet-options">
          <view class="publish-sheet-option" @tap="handlePublishTeamChallenge">
            <view class="publish-sheet-option-mark">赛</view>
            <view class="publish-sheet-option-copy">
              <view class="publish-sheet-option-title">球队约队</view>
              <view class="publish-sheet-option-text">创建一场正式比赛，由球队管理者发布</view>
            </view>
          </view>

          <view class="publish-sheet-option" @tap="handlePublishIndividualChallenge">
            <view class="publish-sheet-option-mark publish-sheet-option-mark-light">人</view>
            <view class="publish-sheet-option-copy">
              <view class="publish-sheet-option-title">散人约队</view>
              <view class="publish-sheet-option-text">创建面向球员个人报名的约队</view>
            </view>
          </view>
        </view>

        <view class="publish-sheet-cancel" @tap="closePublishTypeSheet">取消</view>
      </view>
    </view>

    <view v-if="hallCards.length" class="hall-sections">
      <view class="hall-section">
        <view class="hall-section-head">
          <view>
            <view class="hall-section-title">球队约队</view>
            <view class="hall-section-caption">只有当前球队的队长或领队可以接约。</view>
          </view>
          <text class="hall-section-count">{{ teamHallCards.length }}</text>
        </view>
        <view v-if="teamHallCards.length" class="hall-list">
          <view
            v-for="card in teamHallCards"
            :key="card.id"
            class="hall-card"
            @tap="openChallengeDetail(card.id)"
          >
            <view class="hall-card-top">
              <view class="hall-card-title-wrap">
                <text class="hall-card-title">{{ card.title }}</text>
                <view class="hall-card-tags">
                  <text
                    v-for="tag in card.quickTags"
                    :key="tag"
                    :class="[
                      'hall-tag',
                      tag === card.trustLabel ? 'hall-tag-credit' : tag === card.relationLabel ? 'hall-tag-relation' : '',
                    ]"
                  >
                    {{ tag }}
                  </text>
                </view>
              </view>
              <view class="hall-card-price">
                <text :class="['hall-status-badge', `hall-status-badge-${card.statusTone}`]">{{ card.statusLabel }}</text>
                <text class="hall-card-price-text">{{ card.priceLabel }}</text>
              </view>
            </view>

            <view class="hall-meta-row">
              <text class="hall-meta-icon">场</text>
              <text class="hall-meta-text">{{ card.venue }}</text>
            </view>
            <view class="hall-meta-row">
              <text class="hall-meta-icon">时</text>
              <text class="hall-meta-text">{{ card.monthDayLabel }} {{ card.weekdayLabel }} {{ card.timeRangeLabel }}</text>
            </view>

            <view v-if="card.note" class="hall-note">{{ card.note }}</view>

            <view class="hall-card-bottom">
              <view class="hall-team-block">
                <view class="hall-team-logo">{{ card.teamInitial }}</view>
                <view class="hall-team-info">
                  <text class="hall-team-name">{{ card.hostTeamName }}</text>
                  <text class="hall-team-meta">信用 {{ card.creditScore }} · {{ card.trustLabel }}</text>
                </view>
              </view>
              <view class="hall-card-action-column">
                <text class="hall-score-chip">{{ card.creditScore }} 分</text>
                <view class="hall-card-button" @tap.stop="handlePrimaryAction(card)">
                  {{ submitting && card.canAccept ? "处理中..." : card.primaryActionLabel }}
                </view>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="hall-section-empty">当前筛选下还没有球队约队。</view>
      </view>

      <view class="hall-section">
        <view class="hall-section-head">
          <view>
            <view class="hall-section-title">散人约队</view>
            <view class="hall-section-caption">没满员就能报名，但散人约队同一时间只能接一场。</view>
          </view>
          <text class="hall-section-count">{{ individualHallCards.length }}</text>
        </view>
        <view v-if="individualHallCards.length" class="hall-list">
          <view
            v-for="card in individualHallCards"
            :key="card.id"
            class="hall-card"
            @tap="openChallengeDetail(card.id)"
          >
            <view class="hall-card-top">
              <view class="hall-card-title-wrap">
                <text class="hall-card-title">{{ card.title }}</text>
                <view class="hall-card-tags">
                  <text
                    v-for="tag in card.quickTags"
                    :key="tag"
                    :class="['hall-tag', tag === card.relationLabel ? 'hall-tag-relation' : '']"
                  >
                    {{ tag }}
                  </text>
                </view>
              </view>
              <view class="hall-card-price">
                <text :class="['hall-status-badge', `hall-status-badge-${card.statusTone}`]">{{ card.statusLabel }}</text>
                <text class="hall-card-price-text">{{ card.priceLabel }}</text>
              </view>
            </view>

            <view class="hall-meta-row">
              <text class="hall-meta-icon">场</text>
              <text class="hall-meta-text">{{ card.venue }}</text>
            </view>
            <view class="hall-meta-row">
              <text class="hall-meta-icon">时</text>
              <text class="hall-meta-text">{{ card.monthDayLabel }} {{ card.weekdayLabel }} {{ card.timeRangeLabel }}</text>
            </view>

            <view v-if="card.note" class="hall-note">{{ card.note }}</view>

            <view class="hall-card-bottom">
              <view class="hall-team-block">
                <view class="hall-team-logo">{{ card.teamInitial }}</view>
                <view class="hall-team-info">
                  <text class="hall-team-name">{{ card.hostTeamName }}</text>
                  <text class="hall-team-meta">已报名 {{ card.acceptedCount }}/{{ card.capacity }} · {{ card.trustLabel }}</text>
                </view>
              </view>
              <view class="hall-card-action-column">
                <text class="hall-score-chip">{{ card.acceptedCount }}/{{ card.capacity }}</text>
                <view class="hall-card-button" @tap.stop="handlePrimaryAction(card)">
                  {{ submitting && card.canAccept ? "处理中..." : card.primaryActionLabel }}
                </view>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="hall-section-empty">当前筛选下还没有散人约队。</view>
      </view>
    </view>

    <view v-else class="hall-empty hall-empty-spacious">
      当前筛选条件下还没有约队记录，可以切换日期、标签，或者直接发布一条新的约队。
    </view>

    <BottomTabBar current="challenge" />
  </view>
</template>

<style scoped>
.hall-page {
  min-height: 100vh;
  padding: calc(env(safe-area-inset-top) + 36rpx) 28rpx 164rpx;
  background:
    radial-gradient(circle at top right, rgba(200, 255, 0, 0.14), transparent 28%),
    linear-gradient(180deg, #ffffff 0%, #f5f6f2 100%);
  box-sizing: border-box;
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

.hall-toolbar {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 28rpx;
}

.hall-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 0 26rpx;
  height: 92rpx;
  border-radius: 999rpx;
  background: #eef0ea;
}

.hall-search-icon {
  font-size: 28rpx;
  font-weight: 800;
  color: #6d7069;
}

.hall-search-input {
  flex: 1;
  font-size: 28rpx;
  color: #1b1c19;
}

.hall-publish-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 204rpx;
  height: 92rpx;
  padding: 0 28rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #111111;
  font-size: 30rpx;
  font-weight: 900;
  box-shadow: 0 14rpx 28rpx rgba(173, 214, 0, 0.18);
}

.hall-publish-button-disabled {
  background: #d8dccf;
  color: #70756c;
  box-shadow: none;
}

.publish-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(17, 19, 16, 0.62);
}

.publish-sheet {
  width: calc(100% - 48rpx);
  margin: 0 24rpx calc(env(safe-area-inset-bottom) + 22rpx);
  padding: 38rpx 44rpx 40rpx;
  border-radius: 32rpx;
  background: #ffffff;
  box-sizing: border-box;
  box-shadow: 0 -18rpx 54rpx rgba(17, 19, 16, 0.14);
}

.publish-sheet-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52rpx;
}

.publish-sheet-title {
  color: #111310;
  font-size: 32rpx;
  font-weight: 900;
  line-height: 1.3;
}

.publish-sheet-close {
  position: absolute;
  right: -12rpx;
  top: 50%;
  width: 56rpx;
  height: 56rpx;
  margin-top: -28rpx;
  color: #5f625b;
  font-size: 44rpx;
  line-height: 52rpx;
  text-align: center;
}

.publish-sheet-options {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 48rpx;
}

.publish-sheet-option {
  display: flex;
  align-items: center;
  gap: 22rpx;
  min-height: 112rpx;
  padding: 20rpx 22rpx;
  border-radius: 28rpx;
  background: #f7f8f4;
  box-sizing: border-box;
}

.publish-sheet-option:active {
  background: #eef1e8;
}

.publish-sheet-option-mark {
  flex: 0 0 64rpx;
  width: 64rpx;
  height: 64rpx;
  border-radius: 22rpx;
  background: #c8ff00;
  color: #111310;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 64rpx;
  text-align: center;
}

.publish-sheet-option-mark-light {
  background: #111310;
  color: #ffffff;
}

.publish-sheet-option-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 14rpx;
}

.publish-sheet-option-title {
  flex: 0 0 auto;
  color: #111310;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1.35;
}

.publish-sheet-option-text {
  flex: 1;
  min-width: 0;
  color: #747970;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.45;
}

.publish-sheet-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 82rpx;
  margin-top: 34rpx;
  border-radius: 999rpx;
  background: #eef0ed;
  color: #111310;
  font-size: 30rpx;
  font-weight: 900;
}

.hall-quick-filters {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
  margin-top: 28rpx;
}

.hall-quick-chip {
  padding: 18rpx 28rpx;
  border-radius: 999rpx;
  background: #eceee8;
  color: #242620;
  font-size: 28rpx;
  font-weight: 700;
}

.hall-quick-chip-active {
  background: #c8ff00;
  color: #111111;
}

.hall-date-strip {
  margin-top: 26rpx;
  margin-left: -28rpx;
  margin-right: -28rpx;
  padding: 0 28rpx 6rpx;
}

.hall-date-strip-inner {
  display: inline-flex;
  gap: 18rpx;
}

.hall-date-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 116rpx;
  min-height: 126rpx;
  border-radius: 30rpx;
  background: #ffffff;
  border: 2rpx solid #eceee8;
  box-sizing: border-box;
}

.hall-date-pill-active {
  background: #c8ff00;
  border-color: #c8ff00;
}

.hall-date-week {
  font-size: 24rpx;
  color: #5f6359;
  font-weight: 700;
}

.hall-date-number {
  margin-top: 8rpx;
  font-size: 52rpx;
  line-height: 1;
  color: #141512;
  font-weight: 900;
}

.hall-filter-bar {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 24rpx;
}

.hall-filter-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 82rpx;
  border-radius: 24rpx;
  background: #ffffff;
  color: #20221e;
  font-size: 28rpx;
  font-weight: 700;
}

.hall-filter-action-strong {
  flex: 0 0 156rpx;
}

.hall-panel {
  margin-top: 22rpx;
  padding: 28rpx;
  border-radius: 34rpx;
  background: #ffffff;
  box-shadow: 0 24rpx 48rpx rgba(17, 17, 17, 0.06);
}

.hall-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.hall-panel-title {
  font-size: 34rpx;
  font-weight: 900;
  color: #141512;
}

.hall-panel-caption {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #72766c;
}

.hall-filter-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 22rpx;
}

.hall-filter-switch-label {
  font-size: 28rpx;
  color: #20221e;
  font-weight: 700;
}

.hall-list {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  margin-top: 24rpx;
}

.hall-sections {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-top: 24rpx;
}

.hall-section {
  padding: 28rpx;
  border-radius: 34rpx;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 24rpx 46rpx rgba(17, 17, 17, 0.04);
}

.hall-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.hall-section-title {
  font-size: 34rpx;
  font-weight: 900;
  color: #111111;
}

.hall-section-caption {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #6f756b;
}

.hall-section-count {
  min-width: 64rpx;
  height: 64rpx;
  border-radius: 999rpx;
  background: #eff8d3;
  color: #4c6700;
  font-size: 26rpx;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.hall-section-empty {
  margin-top: 22rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: #f5f6f1;
  color: #676d63;
  font-size: 26rpx;
}

.hall-card {
  padding: 28rpx;
  border-radius: 34rpx;
  background: #ffffff;
  box-shadow: 0 24rpx 46rpx rgba(17, 17, 17, 0.06);
}

.hall-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.hall-card-title-wrap {
  flex: 1;
}

.hall-card-title {
  display: block;
  font-size: 38rpx;
  line-height: 1.3;
  color: #111111;
  font-weight: 900;
}

.hall-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}

.hall-tag {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #f1f3ec;
  color: #3f443c;
  font-size: 22rpx;
  font-weight: 800;
}

.hall-tag-credit {
  background: #eef8d1;
  color: #4b6600;
}

.hall-tag-relation {
  background: #eef0ff;
  color: #4564d6;
}

.hall-card-price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12rpx;
}

.hall-card-price-text {
  font-size: 56rpx;
  line-height: 1;
  color: #111111;
  font-weight: 900;
}

.hall-status-badge {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 800;
}

.hall-status-badge-open {
  background: #eff8d3;
  color: #4c6700;
}

.hall-status-badge-matched {
  background: #e8eeff;
  color: #4564d6;
}

.hall-status-badge-cancelled {
  background: #ffe8eb;
  color: #cf4258;
}

.hall-meta-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 18rpx;
}

.hall-meta-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  border-radius: 999rpx;
  background: #f1f3ec;
  color: #5c6259;
  font-size: 20rpx;
  font-weight: 900;
}

.hall-meta-text {
  flex: 1;
  font-size: 28rpx;
  line-height: 1.5;
  color: #555a52;
}

.hall-note {
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 24rpx;
  background: #f7f8f3;
  color: #42463f;
  font-size: 26rpx;
  line-height: 1.5;
}

.hall-card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 24rpx;
}

.hall-team-block {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
}

.hall-team-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 82rpx;
  height: 82rpx;
  border-radius: 999rpx;
  background: #1a1a19;
  color: #c8ff00;
  font-size: 34rpx;
  font-weight: 900;
  flex-shrink: 0;
}

.hall-team-info {
  min-width: 0;
}

.hall-team-name {
  display: block;
  font-size: 30rpx;
  color: #141512;
  font-weight: 900;
}

.hall-team-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #666b63;
}

.hall-card-action-column {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 16rpx;
}

.hall-score-chip {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #eef8d1;
  color: #597400;
  font-size: 24rpx;
  font-weight: 900;
}

.hall-card-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 182rpx;
  height: 84rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #111111;
  font-size: 30rpx;
  font-weight: 900;
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
