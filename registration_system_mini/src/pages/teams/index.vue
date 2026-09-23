<script setup lang="ts">
import { usePullRefresh } from "@/composables/usePullRefresh";
import { APP_SCROLL_CONTROLLER, createAppScrollAnchor } from "@/components/appScroll";
import { useAccentTheme } from "@/stores/theme";
import { computed, provide, ref } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppPullScrollView from "@/components/AppPullScrollView.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import { tabBarMotion } from "@/components/tabBarMotion";
import AppButton from "@/components/ui/AppButton.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
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
import RunningLoader from "@/components/ui/RunningLoader.vue";
import { buildAttendanceCalendarMonths, buildRecordSummary } from "./teamStatsState";

const { themePageStyle } = useAccentTheme();

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
const contentStyle = computed(() => ({
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

    void syncUnreadCount({ skipEnsure: true }).catch(() => {
      // Notification count is nice-to-have; don't let it block the stats load.
    });
    const [allTimeSummary, yearSummary] = await Promise.all([
      getTeamAttendanceSummary(currentTeam.value.id),
      getTeamAttendanceSummary(currentTeam.value.id, getCurrentYearDateRange()),
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
  tabBarMotion.show("stats");
  // H5 路由切换时 onShow 可能早于 TabBar 挂载，此时无需隐藏。
  uni.hideTabBar({ animation: false, fail: () => {} });
  void loadPageData();
});

onLoad(() => {
  uni.$on("session:login-completed", handleSessionLoginCompleted);
});

onUnload(() => {
  uni.$off("session:login-completed", handleSessionLoginCompleted);
});
// scroll-view 自定义下拉：页面本体不滚动，固定 header 不随下拉拖动。
const { refreshing, handleRefresherRefresh } = usePullRefresh(loadPageData);
// 滚动锚点提升到页面根：AppTabHeader 与滚动容器是兄弟节点，provide 必须来自页面。
const { anchor: appScrollAnchor, controller: appScrollController } = createAppScrollAnchor();
provide(APP_SCROLL_CONTROLLER, appScrollController);
</script>

<template>
  <!-- 页面本体锁定不滚动（滚动在 AppPullScrollView 内），header 不随下拉移动。 -->
  <page-meta :page-style="`${themePageStyle};overflow:hidden`" />
  <view class="app-theme-scope stats-page" :style="themePageStyle">
    <AppTabHeader title="统计" />

    <AppPullScrollView ref="appScrollAnchor" :refreshing="refreshing" @refresh="handleRefresherRefresh">
      <view class="stats-content" :style="contentStyle">
    <template v-if="!requiresLogin">
      <view v-if="errorMessage" class="stats-empty">
        {{ errorMessage }}
        <view v-if="hasNoTeam" class="stats-empty-actions">
          <AppButton class="stats-empty-action" variant="lime" @click="goJoinTeam">加入球队</AppButton>
          <AppButton
            v-if="canShowCreateTeamEntry"
            class="stats-empty-action"
            variant="dark"
            @click="goCreateTeam"
          >
            创建球队
          </AppButton>
        </view>
      </view>
      <RunningLoader v-else-if="isLoading && !hasLoadedOnce" text="正在统计战绩" />

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
          <SegmentedControl
            :model-value="statsTab"
            :options="statsTabOptions"
            class="stats-segment"
            @update:model-value="handleStatsTabChange"
          />

          <!-- key 绑定分页签：仅记录/排行切换时重播轻淡入；年月翻页、下拉刷新不重播。 -->
          <view :key="statsTab" class="stats-tab-content">
            <AttendanceCalendarCard
              v-if="statsTab === 'records'"
              :my-records-count="myRecords.length"
              :calendar-months="attendanceCalendarMonths"
              embedded
            />
            <AttendanceRankingCard v-else :ranking-items="rankingItems" embedded />
          </view>
        </view>
      </template>
      </template>
      </view>
    </AppPullScrollView>

    <BottomTabBar current="stats" />
  </view>
</template>

<style scoped>
.stats-page {
  min-height: 100vh;
  padding: 0 24rpx;
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.stats-content {
  /* 滚动收进 AppPullScrollView 后，底栏留白由滚动内容自己承担。 */
  padding-bottom: 164rpx;
}

.stats-empty {
  margin-top: 18rpx;
  padding: 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-raised);
  color: var(--ui-color-text-muted);
  font-size: 27rpx;
  font-weight: 400;
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
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-raised);
}

.stats-segment {
  margin-bottom: 18rpx;
}

.stats-tab-content {
  animation: stats-tab-fade-in var(--ui-motion-switch-duration) var(--ui-motion-ease-out);
}

@keyframes stats-tab-fade-in {
  from {
    opacity: 0;
    transform: translateY(6rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* H5 减少动态效果：内容直接切换。 */
@media (prefers-reduced-motion: reduce) {
  .stats-tab-content {
    animation: none;
  }
}

/* #ifdef H5 */
.stats-page {
  width: 100%;
  max-width: 750rpx;
  margin: 0 auto;
}

.stats-page :deep(.app-tab-header-shell),
.stats-page :deep(.custom-tabbar) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */
</style>
