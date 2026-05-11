<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import { listActivities } from "@/api/activity";
import { getMyActivities } from "@/api/user";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";
import { toStandLabel } from "@/utils/viewModels";
import type { BackendActivity } from "@/types/backend";

const { currentTeam, ensureSessionReady } = useTeamContext();
const navMetrics = getCustomNavMetrics();

const isLoading = ref(false);
const errorMessage = ref("");
const matchScope = ref<"future" | "past">("future");
const matches = ref<
  Array<{
    id: string;
    title: string;
    dateLabel: string;
    venue: string;
    opponent: string;
    formatLabel: string;
    myStatus: string;
  }>
>([]);

const contentStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));
const scopeOptions = [
  { value: "future", label: "未来比赛" },
  { value: "past", label: "过去比赛" },
];
const emptyText = computed(() =>
  matchScope.value === "future" ? "暂时没有今天及未来的相关比赛。" : "暂时没有过去的相关比赛。",
);
const heroCopy = computed(() =>
  matchScope.value === "future"
    ? "默认展示今天及未来，按比赛时间由近到远排序。"
    : "展示今天之前的相关比赛，按比赛时间由近到远回看。",
);

function parseDateTime(value: string) {
  return new Date(value.replace(" ", "T")).getTime();
}

function todayStartTimestamp() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatDateLabel(isoText: string) {
  const date = new Date(isoText.replace(" ", "T"));
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()] ?? "";
  return `${month}/${day} ${weekday} ${hours}:${minutes}`;
}

function isRelatedActivity(activity: BackendActivity, activeTeamId: string | undefined, relatedActivityIds: Set<string>) {
  return (
    relatedActivityIds.has(activity.id) ||
    (!!activeTeamId && (activity.home_team_id === activeTeamId || activity.away_team_id === activeTeamId))
  );
}

function statusClass(status: string) {
  if (status === "参加") return "match-status-join";
  if (status === "请假") return "match-status-leave";
  if (status === "迟到") return "match-status-late";
  return "match-status-pending";
}

async function loadPageData() {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    await ensureSessionReady();
    const activeTeamId = currentTeam.value?.id;
    const [activityPage, myActivityRecords] = await Promise.all([
      listActivities({ page: 1, pageSize: 100 }),
      getMyActivities(),
    ]);
    const todayStart = todayStartTimestamp();
    const relatedActivityIds = new Set(myActivityRecords.map((item) => item.activity_id));
    const recordByActivityId = Object.fromEntries(myActivityRecords.map((item) => [item.activity_id, item]));

    matches.value = activityPage.items
      .filter((activity) =>
        matchScope.value === "future"
          ? parseDateTime(activity.holding_date) >= todayStart
          : parseDateTime(activity.holding_date) < todayStart,
      )
      .filter((activity) =>
        matchScope.value === "future" ? activity.status !== 2 && activity.status !== 3 : true,
      )
      .filter((activity) => isRelatedActivity(activity, activeTeamId, relatedActivityIds))
      .sort((left, right) =>
        matchScope.value === "future"
          ? left.holding_date.localeCompare(right.holding_date)
          : right.holding_date.localeCompare(left.holding_date),
      )
      .map((activity) => ({
        id: activity.id,
        title: activity.name,
        dateLabel: formatDateLabel(activity.holding_date),
        venue: activity.location,
        opponent: activity.opposing?.trim() || "对手待定",
        formatLabel: activity.players_per_team ? `${activity.players_per_team} 人制` : "人数待定",
        myStatus: toStandLabel(recordByActivityId[activity.id]?.stand ?? 0),
      }));
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "我的比赛加载失败";
  } finally {
    isLoading.value = false;
  }
}

function handleScopeChange(event: Event) {
  const detail = event as Event & { detail?: { value?: string | number } };
  matchScope.value = detail.detail?.value === "past" ? "past" : "future";
  void loadPageData();
}

function openMatchDetail(matchId: string) {
  uni.navigateTo({
    url: `/pages/matches/detail?id=${matchId}`,
  });
}

onShow(() => {
  void loadPageData();
});
</script>

<template>
  <view class="my-matches-page">
    <AppTabHeader title="我的比赛" showBack />
    <view class="my-matches-content" :style="contentStyle">
      <view class="page-hero">
        <wd-text custom-class="page-title" color="#111310" text="我的比赛" />
        <wd-text custom-class="page-copy" color="#66705f" :text="heroCopy" />
      </view>

      <wd-segmented
        :model-value="matchScope"
        :options="scopeOptions"
        custom-class="scope-segment"
        @change="handleScopeChange"
      />

      <view v-if="isLoading" class="empty-card">
        <wd-text custom-class="empty-text" color="#66705f" text="正在加载..." />
      </view>
      <view v-else-if="errorMessage" class="empty-card">
        <wd-text custom-class="empty-text" color="#66705f" :text="errorMessage" />
      </view>
      <view v-else-if="!matches.length" class="empty-card">
        <wd-text custom-class="empty-text" color="#66705f" :text="emptyText" />
      </view>
      <view v-else>
        <view
          v-for="match in matches"
          :key="match.id"
          class="match-card"
          @tap="openMatchDetail(match.id)"
        >
          <view class="match-date-block">
            <wd-text custom-class="match-date-main" color="#ffffff" :text="match.dateLabel.slice(0, 5)" />
            <wd-text custom-class="match-date-time" color="#c8ff00" :text="match.dateLabel.slice(-5)" />
          </view>
          <view class="match-main">
            <view class="match-title-row">
              <wd-text custom-class="match-title" color="#111310" :text="match.title" />
              <wd-tag custom-class="match-status" :class="statusClass(match.myStatus)" round>
                {{ match.myStatus }}
              </wd-tag>
            </view>
            <wd-text custom-class="match-meta" color="#6a7067" :text="match.venue" />
            <wd-text custom-class="match-meta" color="#6a7067" :text="`${match.formatLabel} · 对手 ${match.opponent}`" />
          </view>
          <wd-button custom-class="match-action" custom-style="height:64rpx;border-radius:999rpx;background:#c8ff00;color:#111310;font-size:24rpx;font-weight:900;" size="small">
            去报名
          </wd-button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.my-matches-page {
  min-height: 100vh;
  padding: 0 28rpx 96rpx;
  background: linear-gradient(180deg, #fbfcf7 0%, #eef2e6 100%);
  box-sizing: border-box;
}

.page-hero,
.match-card,
.empty-card {
  border-radius: 30rpx;
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.page-hero {
  padding: 28rpx;
}

.page-title {
  display: block;
  color: #111310;
  font-size: 48rpx;
  line-height: 1.15;
  font-weight: 900;
}

.page-copy {
  display: block;
  margin-top: 12rpx;
  color: #66705f;
  font-size: 26rpx;
  line-height: 1.5;
  font-weight: 700;
}

:deep(.scope-segment) {
  margin-top: 18rpx;
  padding: 8rpx;
  border-radius: 999rpx;
  background: #e9eee1;
}

.match-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 18rpx;
  padding: 20rpx;
}

.match-date-block {
  width: 118rpx;
  height: 118rpx;
  border-radius: 26rpx;
  background: #171814;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.match-date-main {
  font-size: 28rpx;
  font-weight: 900;
}

.match-date-time {
  margin-top: 10rpx;
  color: #c8ff00;
  font-size: 26rpx;
  font-weight: 900;
}

.match-main {
  min-width: 0;
  flex: 1;
}

.match-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.match-title {
  min-width: 0;
  color: #111310;
  font-size: 30rpx;
  line-height: 1.25;
  font-weight: 900;
}

.match-meta {
  display: block;
  margin-top: 8rpx;
  color: #6a7067;
  font-size: 24rpx;
  line-height: 1.35;
  font-weight: 700;
}

.match-status {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 900;
}

.match-status-join {
  background: #eef8d6;
  color: #4f6900;
}

.match-status-leave {
  background: #f0f2ee;
  color: #5f645d;
}

.match-status-late {
  background: #fff1df;
  color: #ad6900;
}

.match-status-pending {
  background: #eceef4;
  color: #5e6473;
}

.match-action {
  flex-shrink: 0;
  padding: 18rpx 22rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #111310;
  font-size: 24rpx;
  font-weight: 900;
}

.empty-card {
  margin-top: 18rpx;
  padding: 44rpx 28rpx;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  font-weight: 800;
}
</style>
