<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import { getActivityUsers, listActivities } from "@/api/activity";
import { getMyActivities, listUsers } from "@/api/user";
import { isRuntimeVisibleActivity, loadMiniAppRuntimeConfig } from "@/config/runtimeConfig";
import { useTeamContext } from "@/stores/teamContext";
import type { BackendUser } from "@/types/backend";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { getCustomNavMetrics } from "@/utils/customNav";
import { buildHomeMatchCards } from "@/utils/viewModels";
import HomeMatchList from "../components/HomeMatchList.vue";

const { currentTeam, ensureSessionReady } = useTeamContext();
const navMetrics = getCustomNavMetrics();

const isLoading = ref(false);
const errorMessage = ref("");
const navigatingMatchId = ref("");
const matches = ref<HomeMatchCardViewModel[]>([]);

const contentStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

const matchCountText = computed(() => `${matches.value.length} 场待处理比赛`);

function isActiveTeamRegistrationActivity(activity: { source_activity_id?: string | null; status?: number | null }) {
  return !!activity.source_activity_id && activity.status !== 3;
}

function buildTeamRegistrationCountsBySourceActivityId(
  activities: Array<{ source_activity_id?: string | null; team_registration_count?: number | null; status?: number | null }>,
) {
  return activities.reduce<Record<string, number>>((counts, activity) => {
    const sourceActivityId = activity.source_activity_id;
    const registrationCount = Number(activity.team_registration_count ?? 0);
    if (isActiveTeamRegistrationActivity(activity) && sourceActivityId && registrationCount > 0) {
      counts[sourceActivityId] = (counts[sourceActivityId] ?? 0) + registrationCount;
    }
    return counts;
  }, {});
}

function progressBaseWidth(joinedPlayers: number, requiredPlayers: number, maxPlayers: number) {
  const denominator = Math.max(maxPlayers || requiredPlayers, 1);
  return `${Math.min((Math.min(joinedPlayers, requiredPlayers) / denominator) * 100, 100)}%`;
}

function progressExtraWidth(joinedPlayers: number, requiredPlayers: number, maxPlayers: number) {
  const denominator = Math.max(maxPlayers || requiredPlayers, 1);
  return `${Math.min((Math.max(joinedPlayers - requiredPlayers, 0) / denominator) * 100, 100)}%`;
}

function progressSplitLeft(requiredPlayers: number, maxPlayers: number) {
  const denominator = Math.max(maxPlayers || requiredPlayers, 1);
  return `${Math.min((requiredPlayers / denominator) * 100, 100)}%`;
}

function statusClass(status: string) {
  if (status === "参加") return "home-status home-status-join";
  if (status === "请假") return "home-status home-status-leave";
  if (status === "缺席") return "home-status home-status-late";
  return "home-status home-status-pending";
}

function stageClass(stage: string) {
  if (stage === "进行中") return "home-stage home-stage-blue";
  if (stage === "已结束") return "home-stage home-stage-dark";
  if (stage === "已取消") return "home-stage home-stage-muted";
  return "home-stage home-stage-red";
}

function signupScopeClass(scope: HomeMatchCardViewModel["signupScope"]) {
  return scope === "internal" ? "home-scope home-scope-internal" : "home-scope home-scope-external";
}

function formatMatchDateBlock(dateLabel: string) {
  const [monthDay, timeLabel] = dateLabel.split(" ");
  const [month, day] = monthDay.split("/");
  const date = new Date(`2026-${month}-${day}T00:00:00`);
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()] ?? "待定";
  return {
    monthDay,
    weekday,
    timeLabel,
  };
}

function handleMatchTap(match: HomeMatchCardViewModel) {
  if (navigatingMatchId.value) return;
  if (!match.canRegister) {
    uni.showToast({
      title: "本场已满员",
      icon: "none",
    });
    return;
  }
  navigatingMatchId.value = match.id;
  uni.navigateTo({
    url: `/pages/matches/detail?id=${match.id}`,
    complete: () => {
      setTimeout(() => {
        navigatingMatchId.value = "";
      }, 500);
    },
  });
}

async function loadPageData() {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    await ensureSessionReady();
    if (!currentTeam.value) {
      matches.value = [];
      errorMessage.value = "当前还没有加入球队。";
      return;
    }

    const runtimeConfig = await loadMiniAppRuntimeConfig();
    const now = new Date();
    const [activityPage, myActivityRecords, users] = await Promise.all([
      listActivities({ page: 1, pageSize: runtimeConfig.home.activity_fetch_page_size }),
      getMyActivities(),
      listUsers(),
    ]);
    const activeActivities = activityPage.items.filter(
      (item) =>
        (item.home_team_id === currentTeam.value?.id || item.away_team_id === currentTeam.value?.id) &&
        isRuntimeVisibleActivity(item, runtimeConfig, now),
    );
    const registrationsByActivityId = Object.fromEntries(
      await Promise.all(activeActivities.map(async (activity) => [activity.id, await getActivityUsers(activity.id)] as const)),
    );
    const usersById = Object.fromEntries(users.map((item: BackendUser) => [item.id, item]));

    matches.value = buildHomeMatchCards({
      teamId: currentTeam.value.id,
      activities: activeActivities,
      myActivityRecords,
      registrationsByActivityId,
      teamRegistrationCountsByActivityId: buildTeamRegistrationCountsBySourceActivityId(activityPage.items),
      usersById,
    });
  } catch (error) {
    matches.value = [];
    errorMessage.value = error instanceof Error ? error.message : "全部比赛加载失败";
  } finally {
    isLoading.value = false;
  }
}

onShow(() => {
  if (navigatingMatchId.value) return;
  void loadPageData();
});
</script>

<template>
  <view class="all-matches-page">
    <AppTabHeader title="全部比赛" showBack />
    <view class="all-matches-content" :style="contentStyle">
      <view class="page-hero">
        <text class="page-title">全部比赛</text>
        <text class="page-copy">{{ matchCountText }}</text>
      </view>

      <view v-if="isLoading" class="empty-card">正在加载待处理比赛...</view>
      <view v-else-if="errorMessage" class="empty-card">{{ errorMessage }}</view>
      <HomeMatchList
        v-else-if="matches.length"
        :matches="matches"
        :is-guest-mode="false"
        :navigating-match-id="navigatingMatchId"
        :format-match-date-block="formatMatchDateBlock"
        :progress-base-width="progressBaseWidth"
        :progress-extra-width="progressExtraWidth"
        :progress-split-left="progressSplitLeft"
        :signup-scope-class="signupScopeClass"
        :stage-class="stageClass"
        :status-class="statusClass"
        @match-tap="handleMatchTap"
      />
      <view v-else class="empty-card">当前球队还没有待处理比赛。</view>
    </view>
  </view>
</template>

<style scoped>
.all-matches-page {
  min-height: 100vh;
  padding: 0 28rpx 96rpx;
  background:
    radial-gradient(circle at top left, rgba(200, 255, 0, 0.12), transparent 24%),
    linear-gradient(180deg, #ffffff 0%, #f4f5f0 100%);
  box-sizing: border-box;
}

.page-hero,
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

.empty-card {
  margin-top: 22rpx;
  padding: 44rpx 28rpx;
  color: #66705f;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.5;
  text-align: center;
  background: #ffffff;
}
</style>
