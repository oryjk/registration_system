<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSegmentedControl from "@/components/neo/NeoSegmentedControl.vue";
import { getTeamAttendanceSummary } from "@/api/team";
import { useMiniReviewStatus } from "@/stores/miniReview";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { useTeamContext } from "@/stores/teamContext";
import { hasManualLogout } from "@/utils/authStorage";
import { getCustomNavMetrics } from "@/utils/customNav";
import { getCurrentYearDateRange } from "@/utils/dateRange";
import { resolveUserDisplayName } from "@/utils/viewModels";
import type { BackendTeamAttendanceRankingItem, BackendTeamMemberAttendanceRecord } from "@/types/backend";
import AttendanceCalendarCard from "./components/AttendanceCalendarCard.vue";
import AttendanceRankingCard from "./components/AttendanceRankingCard.vue";
import StatsOverview from "./components/StatsOverview.vue";
import StatsSkeleton from "./components/StatsSkeleton.vue";
import { buildAttendanceCalendarMonths, buildRecordSummary } from "./teamStatsState";

const { currentTeam, currentUser, ensureSessionReady } = useTeamContext();
const { syncUnreadCount } = useNotificationCenter();
const { shouldHideCreationEntrances } = useMiniReviewStatus();
const navMetrics = getCustomNavMetrics();

const isLoading = ref(false);
const isSilentRefreshing = ref(false);
const hasLoadedOnce = ref(false);
const errorMessage = ref("");
const hasNoTeam = ref(false);
const requiresLogin = ref(false);
const myRecords = ref<BackendTeamMemberAttendanceRecord[]>([]);
const myYearRecords = ref<BackendTeamMemberAttendanceRecord[]>([]);
const rankingItems = ref<BackendTeamAttendanceRankingItem[]>([]);
const statsTab = ref<"records" | "ranking">("records");

const currentYear = new Date().getFullYear();
const currentTeamName = computed(() => currentTeam.value?.name || "当前球队");
const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));
const myDisplayName = computed(() => resolveUserDisplayName(currentUser.value));
const myAvatarUrl = computed(() => currentUser.value?.avatar_url?.trim() || "");
const myInitial = computed(() => myDisplayName.value.slice(0, 1) || "我");
const mySummary = computed(() => buildRecordSummary(myYearRecords.value));
const attendanceCalendarMonths = computed(() => buildAttendanceCalendarMonths(myRecords.value));
// 审核模式下沿用全局约定：隐藏“创建球队”入口，空态仅保留“加入球队”。
const canShowCreateTeamEntry = computed(() => !shouldHideCreationEntrances.value);
const statsTabOptions = [
  { value: "records", label: "出勤记录" },
  { value: "ranking", label: "出勤排名" },
];

function handleStatsTabChange(value: string) {
  statsTab.value = value === "ranking" ? "ranking" : "records";
}

function goJoinTeam() {
  uni.navigateTo({ url: "/pages/teams/join/index" });
}

function goCreateTeam() {
  uni.navigateTo({ url: "/pages/teams/create/index" });
}

function resetStatsData() {
  myRecords.value = [];
  myYearRecords.value = [];
  rankingItems.value = [];
}

async function loadPageData() {
  if (hasManualLogout()) {
    requiresLogin.value = true;
    errorMessage.value = "";
    hasNoTeam.value = false;
    isLoading.value = false;
    resetStatsData();
    return;
  }

  requiresLogin.value = false;
  errorMessage.value = "";
  hasNoTeam.value = false;

  // 首次进入用骨架屏占位；再次进页（onShow）保留已渲染内容静默刷新，
  // 避免内容 → 骨架屏 → 内容的闪烁。
  const preserveContent = hasLoadedOnce.value;
  if (preserveContent) {
    if (isSilentRefreshing.value) return;
    isSilentRefreshing.value = true;
  } else {
    isLoading.value = true;
  }

  try {
    await ensureSessionReady();
    if (!currentTeam.value) {
      resetStatsData();
      hasNoTeam.value = true;
      errorMessage.value = "当前还没有加入球队。";
      return;
    }

    const [allTimeSummary, yearSummary] = await Promise.all([
      getTeamAttendanceSummary(currentTeam.value.id),
      getTeamAttendanceSummary(currentTeam.value.id, getCurrentYearDateRange()),
      syncUnreadCount({ skipEnsure: true }),
    ]);
    myRecords.value = allTimeSummary.my_records;
    myYearRecords.value = yearSummary.my_records;
    rankingItems.value = yearSummary.ranking;
    hasLoadedOnce.value = true;
  } catch (error) {
    if (preserveContent) {
      // 刷新失败时保留旧数据，仅轻提示，不把已展示的内容闪成错误卡片。
      uni.showToast({
        title: error instanceof Error ? error.message : "统计数据刷新失败",
        icon: "none",
      });
    } else {
      resetStatsData();
      errorMessage.value = error instanceof Error ? error.message : "统计数据加载失败";
    }
  } finally {
    isLoading.value = false;
    isSilentRefreshing.value = false;
  }
}

function handleSessionLoginCompleted() {
  void loadPageData();
}

onShow(() => {
  uni.hideTabBar({ animation: false });
  void loadPageData();
});

onLoad(() => {
  uni.$on("session:login-completed", handleSessionLoginCompleted);
});

onUnload(() => {
  uni.$off("session:login-completed", handleSessionLoginCompleted);
});
</script>

<template>
  <view class="stats-page" :style="pageStyle">
    <AppTabHeader title="统计" />

    <template v-if="!requiresLogin">
      <view v-if="errorMessage" class="stats-empty">
        {{ errorMessage }}
        <view v-if="hasNoTeam" class="stats-empty-actions">
          <NeoButton class="stats-empty-action" variant="lime" @click="goJoinTeam">加入球队</NeoButton>
          <NeoButton
            v-if="canShowCreateTeamEntry"
            class="stats-empty-action"
            variant="dark"
            @click="goCreateTeam"
          >
            创建球队
          </NeoButton>
        </view>
      </view>
      <StatsSkeleton v-else-if="isLoading && !hasLoadedOnce" />

      <template v-else>
        <StatsOverview
          :current-year="currentYear"
          :my-avatar-url="myAvatarUrl"
          :my-initial="myInitial"
          :my-display-name="myDisplayName"
          :current-team-name="currentTeamName"
          :my-summary="mySummary"
        />
        <view class="stats-tab-card">
          <NeoSegmentedControl
            :model-value="statsTab"
            :options="statsTabOptions"
            class="stats-segment"
            @update:model-value="handleStatsTabChange"
          />

          <AttendanceCalendarCard
            v-if="statsTab === 'records'"
            :my-records-count="myRecords.length"
            :calendar-months="attendanceCalendarMonths"
            embedded
          />
          <AttendanceRankingCard v-else :ranking-items="rankingItems" embedded />
        </view>
      </template>
    </template>

    <BottomTabBar current="stats" />
  </view>
</template>

<style scoped>
.stats-page {
  min-height: 100vh;
  padding: calc(env(safe-area-inset-top) + 30rpx) 24rpx 164rpx;
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.stats-empty {
  margin-top: 18rpx;
  padding: 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
  color: var(--neo-color-text-muted);
  font-size: 27rpx;
  font-weight: 700;
  line-height: 1.6;
}

.stats-empty-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
}

.stats-empty-action {
  flex: 1;
}

.stats-tab-card {
  margin-top: 16rpx;
  padding: 16rpx 22rpx 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
}

.stats-segment {
  margin-bottom: 18rpx;
}
</style>
