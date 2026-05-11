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
    timeLabel: string;
    venue: string;
    opponent: string;
    formatLabel: string;
    myStatus: string;
    kindLabel: string;
    isEditable: boolean;
    color: string;
    opposingColor: string;
    locationLatitude: number | null;
    locationLongitude: number | null;
    statusTone: "default" | "success" | "warning" | "muted";
  }>
>([]);

const contentStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

const scopeOptions = [
  { value: "future", label: "未开始" },
  { value: "past", label: "已结束" },
];

const emptyText = computed(() =>
  matchScope.value === "future" ? "暂时没有未开始的相关比赛。" : "暂时没有已结束的相关比赛。",
);

const heroCopy = computed(() =>
  matchScope.value === "future"
    ? "展示今天及未来的比赛，按时间顺序排列。"
    : "展示今天之前的比赛，方便回看历史记录。",
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

function formatTimeLabel(isoText: string) {
  const date = new Date(isoText.replace(" ", "T"));
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isRelatedActivity(activity: BackendActivity, activeTeamId: string | undefined, relatedActivityIds: Set<string>) {
  return (
    relatedActivityIds.has(activity.id) ||
    (!!activeTeamId && (activity.home_team_id === activeTeamId || activity.away_team_id === activeTeamId))
  );
}

function isPublisherEditable(activity: BackendActivity, activeTeamId?: string) {
  if (!activeTeamId) return false;
  if (activity.source_activity_id) return false;
  if (activity.status === 2 || activity.status === 3) return false;
  return activity.home_team_id === activeTeamId;
}

function statusTone(status: string) {
  if (status === "参加") return "success";
  if (status === "请假") return "warning";
  if (status === "缺席") return "warning";
  return "muted";
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

function openMatchEdit(matchId: string) {
  uni.navigateTo({
    url: `/pages/matches/create/index?id=${matchId}&mode=edit`,
  });
}

function openMap(locationLatitude: number | null, locationLongitude: number | null, name: string, address: string) {
  if (locationLatitude == null || locationLongitude == null) {
    uni.showToast({
      title: "暂无可打开的地图定位",
      icon: "none",
    });
    return;
  }

  uni.openLocation({
    latitude: Number(locationLatitude),
    longitude: Number(locationLongitude),
    name,
    address,
  });
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
      .filter((activity) => (matchScope.value === "future" ? activity.status !== 2 && activity.status !== 3 : true))
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
        timeLabel: formatTimeLabel(activity.start_time || activity.holding_date),
        venue: activity.location,
        opponent: activity.opposing?.trim() || "对手待定",
        formatLabel: activity.players_per_team ? `${activity.players_per_team} 人制` : "人数待定",
        myStatus: toStandLabel(recordByActivityId[activity.id]?.stand ?? 0),
        kindLabel: activity.match_kind === "internal" ? "队内内战" : "对外友谊赛",
        isEditable: isPublisherEditable(activity, activeTeamId),
        color: activity.color?.trim() || "#2F6BFF",
        opposingColor: activity.opposing_color?.trim() || "#C8FF00",
        locationLatitude: activity.location_latitude ?? null,
        locationLongitude: activity.location_longitude ?? null,
        statusTone: statusTone(toStandLabel(recordByActivityId[activity.id]?.stand ?? 0)),
      }));
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "我的比赛加载失败";
  } finally {
    isLoading.value = false;
  }
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
      >
        <template #label="{ option }">
          <text>{{ option.value === "future" ? "未开始" : "已结束" }}</text>
        </template>
      </wd-segmented>

      <view v-if="isLoading" class="matches-skeleton-stack">
        <view class="matches-skeleton-card" />
        <view class="matches-skeleton-card" />
      </view>
      <view v-else-if="errorMessage" class="empty-card">
        <wd-text custom-class="empty-text" color="#66705f" :text="errorMessage" />
      </view>
      <view v-else-if="!matches.length" class="empty-card">
        <wd-text custom-class="empty-text" color="#66705f" :text="emptyText" />
      </view>
      <view v-else class="match-list">
        <view
          v-for="match in matches"
          :key="match.id"
          class="match-card"
          @tap="openMatchDetail(match.id)"
        >
          <view class="match-title-row">
            <text class="match-title">{{ match.title }}</text>
            <view v-if="match.isEditable" class="match-edit-link" @tap.stop="openMatchEdit(match.id)">
              编辑比赛
            </view>
          </view>

          <view class="match-subline">
            <text class="match-kind-badge">{{ match.kindLabel }}</text>
            <text :class="['match-status-badge', `match-status-badge-${match.statusTone}`]">{{ match.myStatus }}</text>
            <text class="match-footer-text">{{ match.formatLabel }}</text>
            <text class="match-footer-text">{{ match.timeLabel }}</text>
          </view>

          <view class="match-center">
            <view class="team-block">
              <view class="team-kit">
                <view class="team-jersey" :style="{ '--jersey-color': match.color }">
                  <view class="team-jersey-body">
                    <view class="team-jersey-collar" />
                    <view class="team-jersey-stripe" />
                  </view>
                </view>
              </view>
              <text class="team-label">主队</text>
            </view>
            <view class="match-vs">VS</view>
            <view class="team-block team-block-right">
              <view class="team-kit">
                <view class="team-jersey team-jersey-mirror" :style="{ '--jersey-color': match.opposingColor }">
                  <view class="team-jersey-body">
                    <view class="team-jersey-collar" />
                    <view class="team-jersey-stripe" />
                  </view>
                </view>
              </view>
              <text class="team-label">{{ match.opponent }}</text>
            </view>
          </view>

          <view class="match-footline">
            <text class="match-footline-label">时间 {{ match.dateLabel }}</text>
            <text
              class="match-footline-link"
              @tap.stop="openMap(match.locationLatitude, match.locationLongitude, match.title, match.venue)"
            >
              {{ match.venue }}
            </text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.my-matches-page {
  min-height: 100vh;
  padding: 0 28rpx 96rpx;
  background:
    radial-gradient(circle at top right, rgba(200, 255, 0, 0.12), transparent 20%),
    linear-gradient(180deg, #fbfcf7 0%, #eef2e6 100%);
  box-sizing: border-box;
}

.page-hero,
.match-card,
.empty-card {
  border-radius: 30rpx;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.page-hero {
  padding: 28rpx;
  background: #ffffff;
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

.match-list {
  margin-top: 16rpx;
}

.match-card {
  margin-top: 14rpx;
  padding: 14rpx 16rpx 12rpx;
  background: linear-gradient(180deg, #111310 0%, #191b18 100%);
  color: #ffffff;
}

.match-title-row,
.match-subline,
.match-footline,
.match-center {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.match-kind-badge,
.match-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  font-size: 18rpx;
  font-weight: 900;
}

.match-kind-badge {
  background: rgba(200, 255, 0, 0.16);
  color: #c8ff00;
}

.match-status-badge {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.match-status-badge-success {
  background: rgba(200, 255, 0, 0.16);
  color: #c8ff00;
}

.match-status-badge-warning {
  background: rgba(255, 183, 77, 0.18);
  color: #ffcf7a;
}

.match-status-badge-muted {
  background: rgba(255, 255, 255, 0.1);
  color: #d4d8cf;
}

.match-title-row {
  gap: 12rpx;
}

.match-title {
  min-width: 0;
  flex: 1;
  font-size: 30rpx;
  line-height: 1.15;
  font-weight: 900;
  color: #ffffff;
}

.match-edit-link {
  flex-shrink: 0;
  padding: 0 12rpx;
  min-height: 40rpx;
  border-radius: 999rpx;
  background: rgba(200, 255, 0, 0.14);
  color: #c8ff00;
  font-size: 20rpx;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}

.match-subline {
  margin-top: 8rpx;
  gap: 8rpx;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.match-center {
  margin-top: 10rpx;
  gap: 10rpx;
}

.team-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8rpx;
  min-width: 0;
  flex: 1;
}

.team-block-right {
  align-items: flex-end;
}

.team-kit {
  width: 72rpx;
  height: 60rpx;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.team-jersey {
  position: relative;
  width: 50rpx;
  height: 46rpx;
  border-radius: 12rpx 12rpx 14rpx 14rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(0, 0, 0, 0.1) 100%),
    var(--jersey-color);
  box-shadow:
    inset 0 -8rpx 0 rgba(0, 0, 0, 0.14),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.24),
    0 6rpx 16rpx rgba(0, 0, 0, 0.2);
  overflow: visible;
}

.team-jersey::before,
.team-jersey::after {
  content: "";
  position: absolute;
  top: 4rpx;
  width: 20rpx;
  height: 24rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(0, 0, 0, 0.08) 100%),
    var(--jersey-color);
  border-radius: 12rpx 12rpx 8rpx 8rpx;
  box-shadow: inset 0 -4rpx 0 rgba(0, 0, 0, 0.08);
}

.team-jersey::before {
  left: -10rpx;
  transform: rotate(-14deg);
}

.team-jersey::after {
  right: -10rpx;
  transform: rotate(14deg);
}

.team-jersey-body {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
}

.team-jersey-collar {
  position: absolute;
  left: 50%;
  top: 3rpx;
  width: 22rpx;
  height: 12rpx;
  transform: translateX(-50%);
  border-radius: 0 0 12rpx 12rpx;
  background: rgba(255, 255, 255, 0.2);
}

.team-jersey-stripe {
  position: absolute;
  left: 50%;
  top: 18rpx;
  width: 14rpx;
  height: 18rpx;
  transform: translateX(-50%);
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.18);
}

.team-jersey-mirror {
  transform: scaleX(-1);
}

.team-label {
  min-width: 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 20rpx;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.match-vs {
  flex-shrink: 0;
  width: 66rpx;
  height: 66rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: #c8ff00;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 900;
}

.match-footline {
  margin-top: 10rpx;
  gap: 10rpx;
  flex-wrap: wrap;
  justify-content: space-between;
}

.match-footline-label,
.match-footline-link {
  font-size: 20rpx;
  line-height: 1.2;
  font-weight: 800;
}

.match-footline-label {
  color: rgba(255, 255, 255, 0.7);
}

.match-footline-link {
  color: #c8ff00;
}

.match-footer-text {
  color: rgba(255, 255, 255, 0.72);
  font-size: 20rpx;
  font-weight: 700;
}

.empty-card {
  margin-top: 18rpx;
  padding: 44rpx 28rpx;
  text-align: center;
  background: #ffffff;
}

.empty-text {
  font-size: 28rpx;
  font-weight: 800;
}

.matches-skeleton-stack,
.matches-skeleton-card {
  position: relative;
  overflow: hidden;
}

.matches-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 18rpx;
}

.matches-skeleton-card {
  height: 210rpx;
  border-radius: 30rpx;
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.matches-skeleton-card::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.78) 50%, transparent 100%);
  animation: matches-skeleton-shimmer 1.2s ease-in-out infinite;
}

@keyframes matches-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
