<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import { getTeamAttendanceSummary } from "@/api/team";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { useTeamContext } from "@/stores/teamContext";
import { hasManualLogout } from "@/utils/authStorage";
import { getCustomNavMetrics } from "@/utils/customNav";
import { getCurrentYearDateRange } from "@/utils/dateRange";
import { resolveUserDisplayName } from "@/utils/viewModels";
import type { BackendTeamAttendanceRankingItem, BackendTeamMemberAttendanceRecord } from "@/types/backend";
import AttendanceRankingCard from "./components/AttendanceRankingCard.vue";
import AttendanceRecordCard from "./components/AttendanceRecordCard.vue";
import StatsOverview from "./components/StatsOverview.vue";
import StatsSkeleton from "./components/StatsSkeleton.vue";
import { buildAttendanceGroups, buildRecordSummary } from "./teamStatsState";

const { currentTeam, currentUser, ensureSessionReady } = useTeamContext();
const { syncUnreadCount } = useNotificationCenter();
const navMetrics = getCustomNavMetrics();

const isLoading = ref(false);
const errorMessage = ref("");
const requiresLogin = ref(false);
const myRecords = ref<BackendTeamMemberAttendanceRecord[]>([]);
const myYearRecords = ref<BackendTeamMemberAttendanceRecord[]>([]);
const rankingItems = ref<BackendTeamAttendanceRankingItem[]>([]);
const collapsedYears = ref<string[]>([]);
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
const attendanceGroups = computed(() => buildAttendanceGroups(myRecords.value, collapsedYears.value));
const statsTabOptions = [
  { value: "records", label: "出勤记录" },
  { value: "ranking", label: "出勤排名" },
];

function handleStatsTabChange(event: Event) {
  const payload = event as Event & { value?: string | number; detail?: { value?: string | number } };
  const value = payload.value ?? payload.detail?.value;
  statsTab.value = value === "ranking" ? "ranking" : "records";
}

function toggleYear(year: string) {
  if (collapsedYears.value.includes(year)) {
    collapsedYears.value = collapsedYears.value.filter((item) => item !== year);
  } else {
    collapsedYears.value = [...collapsedYears.value, year];
  }
}

function resetStatsData() {
  myRecords.value = [];
  myYearRecords.value = [];
  rankingItems.value = [];
  collapsedYears.value = [];
}

async function loadPageData() {
  if (hasManualLogout()) {
    requiresLogin.value = true;
    errorMessage.value = "";
    isLoading.value = false;
    resetStatsData();
    return;
  }

  requiresLogin.value = false;
  isLoading.value = true;
  errorMessage.value = "";

  try {
    await ensureSessionReady();
    if (!currentTeam.value) {
      resetStatsData();
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
  } catch (error) {
    resetStatsData();
    errorMessage.value = error instanceof Error ? error.message : "统计数据加载失败";
  } finally {
    isLoading.value = false;
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
      <view v-if="errorMessage" class="stats-empty">{{ errorMessage }}</view>
      <StatsSkeleton v-else-if="isLoading" />

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
          <wd-segmented
            :value="statsTab"
            :options="statsTabOptions"
            custom-class="stats-segment app-segment"
            @change="handleStatsTabChange"
          >
            <template #label="{ option }">
              <text>{{ option.value === "ranking" ? "出勤排名" : "出勤记录" }}</text>
            </template>
          </wd-segmented>

          <AttendanceRecordCard
            v-if="statsTab === 'records'"
            :my-records-count="myRecords.length"
            :attendance-groups="attendanceGroups"
            embedded
            @toggle-year="toggleYear"
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
  background: linear-gradient(180deg, #f8faf4 0%, #eef1e8 100%);
  box-sizing: border-box;
}

.stats-empty {
  margin-top: 18rpx;
  padding: 24rpx;
  border-radius: 22rpx;
  background: #ffffff;
  color: #6c7168;
  font-size: 27rpx;
  line-height: 1.6;
}

.stats-tab-card {
  margin-top: 16rpx;
  padding: 18rpx 22rpx 22rpx;
  border-radius: 24rpx;
  background: #ffffff;
  border: 1rpx solid rgba(31, 35, 26, 0.07);
  box-shadow: 0 14rpx 32rpx rgba(20, 24, 16, 0.05);
}

:deep(.stats-segment) {
  margin-bottom: 18rpx;
}
</style>
