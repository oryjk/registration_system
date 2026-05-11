<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { getAttendanceRanking, getMyAttendance } from "@/api/user";
import { useTeamContext } from "@/stores/teamContext";
import { hasManualLogout } from "@/utils/authStorage";
import { getCustomNavMetrics } from "@/utils/customNav";
import type {
  BackendAttendanceRankingItem,
  BackendUserAttendanceRecord,
} from "@/types/backend";
import { buildAttendanceSummary, toStandLabel } from "@/utils/viewModels";

const { currentTeam, teamDetailsById, ensureSessionReady } = useTeamContext();
const { syncUnreadCount } = useNotificationCenter();
const navMetrics = getCustomNavMetrics();

const isLoading = ref(false);
const errorMessage = ref("");
const requiresLogin = ref(false);
const attendanceRecords = ref<BackendUserAttendanceRecord[]>([]);
const rankingItems = ref<BackendAttendanceRankingItem[]>([]);

const personalSummary = computed(() => buildAttendanceSummary(attendanceRecords.value));
const currentTeamMemberIds = computed(
  () => new Set((currentTeam.value ? teamDetailsById.value[currentTeam.value.id]?.members ?? [] : []).map((item) => item.user_id)),
);
const teamRankings = computed(() =>
  rankingItems.value.filter((item) => currentTeamMemberIds.value.has(item.user_id)).slice(0, 10),
);
const currentTeamName = computed(() => currentTeam.value?.name || "当前球队");
const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

function attendanceClass(attendance: string) {
  if (attendance === "参加") return "stats-status stats-status-join";
  if (attendance === "迟到") return "stats-status stats-status-late";
  if (attendance === "请假") return "stats-status stats-status-leave";
  return "stats-status stats-status-pending";
}

function formatDateLabel(isoText: string) {
  const date = new Date(isoText.replace(" ", "T"));
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function resetStatsData() {
  attendanceRecords.value = [];
  rankingItems.value = [];
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
    const [attendance, ranking] = await Promise.all([
      getMyAttendance(),
      getAttendanceRanking(),
      syncUnreadCount({ skipEnsure: true }),
    ]);
    attendanceRecords.value = attendance;
    rankingItems.value = ranking;
  } catch (error) {
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
      <view v-else-if="isLoading" class="stats-empty">正在加载统计...</view>

      <view class="stats-hero">
        <view>
          <text class="stats-hero-tag">本队概览</text>
          <text class="stats-hero-title">{{ currentTeamName }}</text>
          <text class="stats-hero-copy">当前页面展示真实出勤记录、个人出勤率和本队成员排行。</text>
        </view>
        <view class="stats-hero-rate">{{ personalSummary.attendanceRate }}</view>
      </view>

      <view class="stats-digest-grid">
        <view class="stats-digest-card">
          <text class="stats-digest-value">{{ personalSummary.attended }}</text>
          <text class="stats-digest-label">参加</text>
        </view>
        <view class="stats-digest-card">
          <text class="stats-digest-value">{{ personalSummary.leave }}</text>
          <text class="stats-digest-label">请假</text>
        </view>
        <view class="stats-digest-card">
          <text class="stats-digest-value">{{ personalSummary.late }}</text>
          <text class="stats-digest-label">迟到</text>
        </view>
        <view class="stats-digest-card">
          <text class="stats-digest-value">{{ personalSummary.pending }}</text>
          <text class="stats-digest-label">待定</text>
        </view>
      </view>

      <view class="stats-card">
        <view class="stats-card-head">
          <view>
            <text class="stats-card-title">我的出勤记录</text>
            <text class="stats-card-caption">按真实比赛报名状态统计。</text>
          </view>
        </view>

        <view v-if="attendanceRecords.length" class="stats-list">
          <view v-for="item in attendanceRecords" :key="item.activity_id" class="stats-list-item">
            <view class="stats-list-copy">
              <text class="stats-list-title">{{ item.activity_name }}</text>
              <text class="stats-list-meta">{{ formatDateLabel(item.holding_date) }} · {{ item.location }}</text>
            </view>
            <view class="stats-list-side">
              <text :class="attendanceClass(toStandLabel(item.stand))">{{ toStandLabel(item.stand) }}</text>
              <text class="stats-list-note">{{ item.registration_count }} 人报名</text>
            </view>
          </view>
        </view>
        <view v-else class="stats-empty">还没有出勤记录。</view>
      </view>

      <view class="stats-card">
        <view class="stats-card-head">
          <view>
            <text class="stats-card-title">当前球队出勤排行</text>
            <text class="stats-card-caption">先按全局记录统计，再筛当前球队成员。</text>
          </view>
        </view>

        <view v-if="teamRankings.length" class="stats-list">
          <view v-for="(item, index) in teamRankings" :key="item.user_id" class="stats-list-item">
            <view class="stats-rank-badge">{{ index + 1 }}</view>
            <view class="stats-list-copy">
              <text class="stats-list-title">{{ item.user_name }}</text>
              <text class="stats-list-meta">当前球队成员出勤排行</text>
            </view>
            <text class="stats-rank-value">{{ item.attended_count }} 场</text>
          </view>
        </view>
        <view v-else class="stats-empty">当前球队还没有可展示的排行数据。</view>
      </view>
    </template>

    <BottomTabBar current="stats" />
  </view>
</template>

<style scoped>
.stats-page {
  min-height: 100vh;
  padding: calc(env(safe-area-inset-top) + 30rpx) 28rpx 164rpx;
  background:
    radial-gradient(circle at top right, rgba(200, 255, 0, 0.16), transparent 24%),
    linear-gradient(180deg, #fbfcf7 0%, #f2f4ed 100%);
  box-sizing: border-box;
}

.stats-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.stats-title {
  display: block;
  font-size: 64rpx;
  font-weight: 900;
  color: #131410;
}

.stats-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6b7068;
  font-weight: 700;
}

.stats-header-badge {
  padding: 14rpx 22rpx;
  border-radius: 999rpx;
  background: #141512;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 800;
}

.stats-hero,
.stats-card,
.stats-digest-card {
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.stats-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 22rpx;
  padding: 28rpx;
  border-radius: 34rpx;
}

.stats-hero-tag {
  display: inline-flex;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #eef7d7;
  color: #4f6800;
  font-size: 22rpx;
  font-weight: 900;
}

.stats-hero-title {
  display: block;
  margin-top: 14rpx;
  font-size: 38rpx;
  font-weight: 900;
  color: #141512;
}

.stats-hero-copy {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #6b7067;
}

.stats-hero-rate {
  min-width: 150rpx;
  text-align: center;
  font-size: 52rpx;
  font-weight: 900;
  color: #131410;
}

.stats-digest-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 20rpx;
}

.stats-digest-card {
  padding: 24rpx 18rpx;
  border-radius: 28rpx;
}

.stats-digest-value {
  display: block;
  font-size: 44rpx;
  font-weight: 900;
  color: #131410;
}

.stats-digest-label {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #72776e;
  font-weight: 700;
}

.stats-card {
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 30rpx;
}

.stats-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.stats-card-title {
  display: block;
  font-size: 30rpx;
  font-weight: 900;
  color: #151613;
}

.stats-card-caption {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #747972;
  line-height: 1.5;
}

.stats-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 22rpx;
}

.stats-list-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  justify-content: space-between;
}

.stats-list-copy {
  min-width: 0;
  flex: 1;
}

.stats-list-title {
  display: block;
  font-size: 28rpx;
  color: #171814;
  font-weight: 800;
}

.stats-list-meta,
.stats-list-note {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #757a72;
}

.stats-list-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 120rpx;
}

.stats-rank-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
  border-radius: 18rpx;
  background: #eef2e2;
  color: #5b6800;
  font-size: 24rpx;
  font-weight: 900;
  flex-shrink: 0;
}

.stats-rank-value {
  font-size: 26rpx;
  color: #171814;
  font-weight: 900;
}

.stats-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 100rpx;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 800;
}

.stats-status-join {
  background: #eef8d6;
  color: #456100;
}

.stats-status-late {
  background: #fff1df;
  color: #ad6900;
}

.stats-status-leave {
  background: #f0f2ee;
  color: #5f645d;
}

.stats-status-pending {
  background: #eceff4;
  color: #5e6473;
}

.stats-empty {
  margin-top: 20rpx;
  padding: 26rpx;
  border-radius: 28rpx;
  background: #ffffff;
  color: #6c7168;
  font-size: 28rpx;
  line-height: 1.6;
}
</style>
