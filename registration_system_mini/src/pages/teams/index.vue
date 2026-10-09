<script setup lang="ts">
import { beijingDateParts } from "@/utils/datetime";
import { usePullRefresh } from "@/composables/usePullRefresh";
import { APP_SCROLL_CONTROLLER, createAppScrollAnchor } from "@/components/appScroll";
import { useAccentTheme } from "@/stores/theme";
import { computed, provide, ref, watch } from "vue";
import { onHide, onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppPullScrollView from "@/components/AppPullScrollView.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import { tabBarMotion } from "@/components/tabBarMotion";
import AppButton from "@/components/ui/AppButton.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import AvatarPreviewDialog from "@/components/ui/AvatarPreviewDialog.vue";
import type { AvatarItem } from "@/components/ui/avatarTypes";
import { ownHonorAvatarTeam } from "@/pages/honors/honorState";
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

const { currentTeam, currentUser, ensureSessionReady, isBootstrapping } = useTeamContext();
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
const historyRankingItems = ref<BackendTeamAttendanceRankingItem[]>([]);
const statsContext = ref<{ teamId: number; userId: number } | null>(null);
let loadVersion = 0;
let pageVisible = false;
const statsTab = ref<"records" | "ranking" | "history">("records");
const previewAvatar = ref<AvatarItem | null>(null);
const avatarPreviewVisible = ref(false);
const avatarPreviewRendered = ref(false);
const canSharePreviewAvatar = computed(() => !!ownHonorAvatarTeam(previewAvatar.value, currentUser.value?.id));

function openAvatarPreview(avatar: AvatarItem) {
  if (!statsContext.value || avatar.teamId !== statsContext.value.teamId
    || avatar.teamId !== currentTeam.value?.id || statsContext.value.userId !== currentUser.value?.id) return;
  previewAvatar.value = { ...avatar };
  avatarPreviewVisible.value = true;
}

function sharePreviewAvatar() {
  const teamId = ownHonorAvatarTeam(previewAvatar.value, currentUser.value?.id);
  if (!teamId || teamId !== statsContext.value?.teamId || teamId !== currentTeam.value?.id) return;
  avatarPreviewVisible.value = false;
  uni.navigateTo({ url: `/pages/honors/index?teamId=${teamId}` });
}

const currentYear = beijingDateParts(Date.now()).year;
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
  { value: "ranking", label: "年度活跃榜" },
  { value: "history", label: "历史活跃榜" },
];

function handleStatsTabChange(value: string) {
  statsTab.value = value === "ranking" || value === "history" ? value : "records";
}

function goJoinTeam() {
  uni.navigateTo({ url: "/pages/teams/join/index" });
}

function goCreateTeam() {
  uni.navigateTo({ url: "/pages/teams/create/index" });
}
function shareMyHonor() {
  if (currentTeam.value && currentUser.value) uni.navigateTo({ url: `/pages/honors/index?teamId=${currentTeam.value.id}` });
}

function resetStatsData() {
  avatarPreviewVisible.value = false;
  previewAvatar.value = null;
  myRecords.value = [];
  myYearRecords.value = [];
  rankingItems.value = [];
  historyRankingItems.value = [];
  statsContext.value = null;
  hasLoadedOnce.value = false;
}

watch(() => [currentTeam.value?.id, currentUser.value?.id], (next, previous) => {
  if (next[0] === previous[0] && next[1] === previous[1]) return;
  resetStatsData();
  // Session initialization owns these intermediate changes. Its current load
  // continues with the final identity, or surfaces its error without retrying.
  if (isBootstrapping.value) {
    if (isSilentRefreshing.value) isLoading.value = true;
    isSilentRefreshing.value = false;
    return;
  }
  loadVersion += 1;
  isLoading.value = false;
  isSilentRefreshing.value = false;
  if (pageVisible) void loadPageData();
}, { flush: "sync" });

async function loadPageData() {
  if (hasManualLogout()) {
    loadVersion += 1;
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
  const requestVersion = ++loadVersion;
  let requestContext: { teamId: number; userId: number } | null = null;

  try {
    await ensureSessionReady();
    if (requestVersion !== loadVersion) return;
    if (!currentTeam.value || !currentUser.value) {
      resetStatsData();
      hasNoTeam.value = true;
      errorMessage.value = "当前还没有加入球队。";
      return;
    }
    requestContext = { teamId: currentTeam.value.id, userId: currentUser.value.id };
    statsContext.value = requestContext;

    void syncUnreadCount({ skipEnsure: true }).catch(() => {
      // Notification count is nice-to-have; don't let it block the stats load.
    });
    const [allTimeSummary, yearSummary] = await Promise.all([
      getTeamAttendanceSummary(requestContext.teamId),
      getTeamAttendanceSummary(requestContext.teamId, getCurrentYearDateRange()),
    ]);
    if (requestVersion !== loadVersion || hasManualLogout()
      || requestContext.teamId !== currentTeam.value?.id || requestContext.userId !== currentUser.value?.id) return;
    myRecords.value = allTimeSummary.my_records;
    myYearRecords.value = yearSummary.my_records;
    rankingItems.value = yearSummary.ranking;
    historyRankingItems.value = allTimeSummary.ranking;
    hasLoadedOnce.value = true;
  } catch (error) {
    if (requestVersion !== loadVersion) return;
    if (preserveContent && hasLoadedOnce.value) {
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
    if (requestVersion === loadVersion) {
      isLoading.value = false;
      isSilentRefreshing.value = false;
      if (pageVisible && requestContext && (requestContext.teamId !== currentTeam.value?.id
        || requestContext.userId !== currentUser.value?.id)) void loadPageData();
    }
  }
}

function handleSessionLoginCompleted() {
  void loadPageData();
}

onShow(() => {
  pageVisible = true;
  tabBarMotion.show("stats");
  // H5 路由切换时 onShow 可能早于 TabBar 挂载，此时无需隐藏。
  uni.hideTabBar({ animation: false, fail: () => {} });
  void loadPageData();
});

onHide(() => {
  pageVisible = false;
  avatarPreviewVisible.value = false;
});

onLoad(() => {
  uni.$on("session:login-completed", handleSessionLoginCompleted);
});

onUnload(() => {
  pageVisible = false;
  loadVersion += 1;
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

    <AppPullScrollView ref="appScrollAnchor" :refreshing="refreshing" :locked="avatarPreviewRendered" @refresh="handleRefresherRefresh">
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
        <view v-if="currentTeam && currentUser" class="stats-honor-share"><AppButton block variant="outline" @click="shareMyHonor">分享我的荣誉</AppButton></view>
        <view class="stats-tab-card">
          <view class="stats-segment">
            <SegmentedControl
              :model-value="statsTab"
              :options="statsTabOptions"
              @update:model-value="handleStatsTabChange"
            />
          </view>

          <!-- key 绑定分页签：仅记录/排行切换时重播轻淡入；年月翻页、下拉刷新不重播。 -->
          <view :key="statsTab" class="stats-tab-content">
            <AttendanceCalendarCard
              v-if="statsTab === 'records'"
              :my-records-count="myRecords.length"
              :calendar-months="attendanceCalendarMonths"
              embedded
            />
            <AttendanceRankingCard
              v-else-if="statsContext && currentTeam"
              :ranking-items="statsTab === 'history' ? historyRankingItems : rankingItems"
              :cumulative-ranking-items="historyRankingItems"
              :team-id="statsContext.teamId"
              :period="statsTab === 'history' ? 'history' : 'annual'"
              embedded
              @avatar-click="openAvatarPreview"
            />
          </view>
        </view>
      </template>
      </template>
      </view>
    </AppPullScrollView>

    <BottomTabBar current="stats" />
    <AvatarPreviewDialog
      :visible="avatarPreviewVisible"
      :avatar="previewAvatar"
      :can-share="canSharePreviewAvatar"
      @share="sharePreviewAvatar"
      @close="avatarPreviewVisible = false"
      @presence="avatarPreviewRendered = $event"
    />
  </view>
</template>

<style scoped>
.stats-honor-share { margin-top: 24rpx; }
.stats-page {
  min-height: 100vh;
  padding: 0 24rpx;
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.stats-content {
  /* 滚动收进 AppPullScrollView 后，底栏留白由滚动内容自己承担。 */
  padding-bottom: var(--ui-tabbar-clearance);
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
  padding: 26rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-raised);
}

.stats-segment {
  margin-bottom: 32rpx;
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

.stats-page :deep(.app-tab-header-shell) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */
</style>
