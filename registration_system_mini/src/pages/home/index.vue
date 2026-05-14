<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import HomeDigestGrid from "./components/HomeDigestGrid.vue";
import HomeHeroSection from "./components/HomeHeroSection.vue";
import HomeMatchList from "./components/HomeMatchList.vue";
import HomeOpportunityList from "./components/HomeOpportunityList.vue";
import HomeSkeleton from "./components/HomeSkeleton.vue";
import { getActivityUsers, listActivities } from "@/api/activity";
import { listChallenges } from "@/api/challenge";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { getMyActivities, getMyAttendance, listUsers } from "@/api/user";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";
import { hasManualLogout } from "@/utils/authStorage";
import { isRuntimeVisibleActivity, isRuntimeVisibleChallengeSummary, loadMiniAppRuntimeConfig } from "@/config/runtimeConfig";
import { getCurrentYearDateRange } from "@/utils/dateRange";
import { buildAttendanceSummary, buildChallengeCards, buildHomeMatchCards, buildPublicHomeMatchCards } from "@/utils/viewModels";
import type { ChallengeCardViewModel, HomeMatchCardViewModel } from "@/types/viewModels";
import type { BackendUser } from "@/types/backend";

const { currentTeam, ensureSessionReady } = useTeamContext();
const { syncUnreadCount } = useNotificationCenter();

const isLoading = ref(false);
const isRefreshing = ref(false);
const hasLoadedOnce = ref(false);
const errorMessage = ref("");
const isGuestMode = ref(false);
const navigatingMatchId = ref("");
const teamMatches = ref<HomeMatchCardViewModel[]>([]);
const challengeCards = ref<ChallengeCardViewModel[]>([]);
const personalDigest = ref({
  attendanceRate: "0%",
  attended: 0,
  leave: 0,
  late: 0,
});

const teamInitial = computed(() => currentTeam.value?.name?.slice(0, 1) || "队");
const teamLogoUrl = computed(() => currentTeam.value?.logoUrl || "");
const navMetrics = getCustomNavMetrics();
const pageStyle = computed(() => ({
  padding: `0 28rpx 180rpx`,
}));
const contentStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));
const showInitialLoadingState = computed(() => isLoading.value && !hasLoadedOnce.value);
const teamMetaLine = computed(() => {
  if (!currentTeam.value) {
    return "登录后加载当前球队信息";
  }

  return `${currentTeam.value.creditScore} 分信用 · 近期 ${teamMatches.value.length} 场待处理比赛`;
});
const manageButtonLabel = computed(() => (currentTeam.value?.canManageTeam ? "球队管理" : "我的"));

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

function progressWidth(joinedPlayers: number, requiredPlayers: number) {
  return `${Math.min((joinedPlayers / Math.max(requiredPlayers, 1)) * 100, 100)}%`;
}

function progressBaseWidth(joinedPlayers: number, requiredPlayers: number, maxPlayers: number) {
  const denominator = Math.max(maxPlayers || requiredPlayers, 1);
  return `${Math.min(Math.min(joinedPlayers, requiredPlayers) / denominator * 100, 100)}%`;
}

function progressExtraWidth(joinedPlayers: number, requiredPlayers: number, maxPlayers: number) {
  const denominator = Math.max(maxPlayers || requiredPlayers, 1);
  return `${Math.min(Math.max(joinedPlayers - requiredPlayers, 0) / denominator * 100, 100)}%`;
}

function progressSplitLeft(requiredPlayers: number, maxPlayers: number) {
  const denominator = Math.max(maxPlayers || requiredPlayers, 1);
  return `${Math.min(requiredPlayers / denominator * 100, 100)}%`;
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

function challengeStageClass(statusTone: ChallengeCardViewModel["statusTone"]) {
  if (statusTone === "matched") return "challenge-pill challenge-pill-blue";
  if (statusTone === "cancelled") return "challenge-pill challenge-pill-red";
  return "challenge-pill challenge-pill-lime";
}

function resetUserRelatedHomeData() {
  personalDigest.value = {
    attendanceRate: "0%",
    attended: 0,
    leave: 0,
    late: 0,
  };
  challengeCards.value = [];
}

async function loadPublicHomeData() {
  const runtimeConfig = await loadMiniAppRuntimeConfig();
  const now = new Date();
  const challengeFetchLimit = Math.min(runtimeConfig.home.challenge_card_limit * 5, 50);
  const [activityPage, users, challengeSummaries] = await Promise.all([
    listActivities({ page: 1, pageSize: runtimeConfig.home.activity_fetch_page_size }),
    listUsers(),
    listChallenges({ limit: challengeFetchLimit, sort: "credit_desc", auth: false }),
  ]);
  const teamRegistrationCountsByActivityId = buildTeamRegistrationCountsBySourceActivityId(activityPage.items);
  const activeActivities = activityPage.items
    .filter((item) => !item.source_activity_id)
    .filter((item) => isRuntimeVisibleActivity(item, runtimeConfig, now))
    .sort((left, right) => left.holding_date.localeCompare(right.holding_date))
    .slice(0, runtimeConfig.home.match_card_limit);
  const registrationsByActivityId = Object.fromEntries(
    await Promise.all(
      activeActivities.map(async (activity) => [activity.id, await getActivityUsers(activity.id)] as const),
    ),
  );
  const usersById = Object.fromEntries(users.map((item: BackendUser) => [item.id, item]));

  teamMatches.value = buildPublicHomeMatchCards({
    activities: activeActivities,
    registrationsByActivityId,
    teamRegistrationCountsByActivityId,
    usersById,
    limit: runtimeConfig.home.match_card_limit,
  });
  challengeCards.value = buildChallengeCards(
    challengeSummaries.filter((summary) => isRuntimeVisibleChallengeSummary(summary, runtimeConfig, now)),
  ).slice(0, runtimeConfig.home.challenge_card_limit);
}

function openTab(path: string) {
  uni.switchTab({ url: path });
}

function openAllPendingMatches() {
  uni.navigateTo({ url: "/pages/home/matches/index" });
}

function handleManageTap() {
  if (currentTeam.value?.canManageTeam) {
    uni.navigateTo({ url: "/pages/teams/manage/index" });
    return;
  }
  uni.switchTab({ url: "/pages/user/index" });
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

async function loadPageData(options?: { preserveContent?: boolean }) {
  const preserveContent = !!options?.preserveContent && hasLoadedOnce.value;

  if (preserveContent) {
    isRefreshing.value = true;
  } else {
    isLoading.value = true;
  }
  errorMessage.value = "";

  try {
    if (hasManualLogout()) {
      isGuestMode.value = true;
      resetUserRelatedHomeData();
      await loadPublicHomeData();
      hasLoadedOnce.value = true;
      return;
    }

    isGuestMode.value = false;
    await ensureSessionReady();
    if (!currentTeam.value) {
      resetUserRelatedHomeData();
      return;
    }

    const runtimeConfig = await loadMiniAppRuntimeConfig();
    const now = new Date();
    const attendanceDateRange = getCurrentYearDateRange(now);
    const challengeFetchLimit = Math.min(runtimeConfig.home.challenge_card_limit * 5, 50);
    const [activityPage, myActivityRecords, attendanceRecords, challengeSummaries, users] = await Promise.all([
      listActivities({ page: 1, pageSize: runtimeConfig.home.activity_fetch_page_size }),
      getMyActivities(),
      getMyAttendance(attendanceDateRange),
      listChallenges({ teamId: currentTeam.value.id, limit: challengeFetchLimit, sort: "credit_desc" }),
      listUsers(),
      syncUnreadCount({ skipEnsure: true }),
    ]);
    const usersById = Object.fromEntries(users.map((item: BackendUser) => [item.id, item]));
    const teamRegistrationCountsByActivityId = buildTeamRegistrationCountsBySourceActivityId(activityPage.items);

    const activeActivities = activityPage.items.filter(
      (item) =>
        (item.home_team_id === currentTeam.value?.id || item.away_team_id === currentTeam.value?.id) &&
        isRuntimeVisibleActivity(item, runtimeConfig, now),
    );
    const focusedActivities = activeActivities
      .sort((left, right) => left.holding_date.localeCompare(right.holding_date))
      .slice(0, runtimeConfig.home.match_card_limit);

    const registrationsByActivityId = Object.fromEntries(
      await Promise.all(
        focusedActivities.map(async (activity) => [activity.id, await getActivityUsers(activity.id)] as const),
      ),
    );

    teamMatches.value = buildHomeMatchCards({
      teamId: currentTeam.value.id,
      activities: focusedActivities,
      myActivityRecords,
      registrationsByActivityId,
      teamRegistrationCountsByActivityId,
      usersById,
      limit: runtimeConfig.home.match_card_limit,
    });

    const summary = buildAttendanceSummary(attendanceRecords);
    personalDigest.value = {
      attendanceRate: summary.attendanceRate,
      attended: summary.attended,
      leave: summary.leave,
      late: summary.late,
    };
    challengeCards.value = buildChallengeCards(
      challengeSummaries.filter((summary) => isRuntimeVisibleChallengeSummary(summary, runtimeConfig, now)),
    ).slice(0, runtimeConfig.home.challenge_card_limit);
    hasLoadedOnce.value = true;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "首页数据加载失败";
  } finally {
    if (preserveContent) {
      isRefreshing.value = false;
    } else {
      isLoading.value = false;
    }
  }
}

function handleSessionLoginCompleted() {
  void loadPageData({ preserveContent: true });
}

onShow(() => {
  uni.hideTabBar({ animation: false });
  if (navigatingMatchId.value) return;
  void loadPageData({ preserveContent: hasLoadedOnce.value });
});

onLoad(() => {
  uni.$on("session:login-completed", handleSessionLoginCompleted);
});

onUnload(() => {
  uni.$off("session:login-completed", handleSessionLoginCompleted);
});
</script>

<template>
  <view class="home-page" :style="pageStyle">
    <AppTabHeader title="首页" showLocation />

    <view class="home-content" :style="contentStyle">
      <HomeSkeleton v-if="showInitialLoadingState" />

      <view v-else>
        <view v-if="isRefreshing" class="home-refresh-mask">
          <view class="home-refresh-chip">更新中...</view>
        </view>

        <HomeHeroSection
          :current-team="currentTeam"
          :team-logo-url="teamLogoUrl"
          :team-initial="teamInitial"
          :team-meta-line="teamMetaLine"
          :manage-button-label="manageButtonLabel"
          :is-guest-mode="isGuestMode"
          @manage-tap="handleManageTap"
          @banner-tap="openTab('/pages/activities/index')"
        />

        <view class="section-headline">
          <view class="section-headline-left">
            <text class="section-fire">热</text>
            <text class="section-headline-title">最近要处理的比赛</text>
          </view>
          <view class="section-link" @tap="openAllPendingMatches">全部比赛</view>
        </view>

        <HomeMatchList
          v-if="teamMatches.length"
          :matches="teamMatches"
          :is-guest-mode="isGuestMode"
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
        <view v-else class="home-empty">
          {{ isGuestMode ? "当前还没有可展示的公开比赛。" : "当前球队还没有可展示的比赛，等后台录入活动后这里会自动刷新。" }}
        </view>

        <view class="section-headline">
          <view>
            <text class="section-headline-title">约队机会</text>
            <text class="section-caption">
              {{ isGuestMode ? "公开约队可先浏览，接约和报名需要登录。" : "只看当前球队值得优先关注的真实约队。" }}
            </text>
          </view>
          <view class="section-link" @tap="openTab('/pages/activities/index')">进入大厅</view>
        </view>

        <HomeOpportunityList
          v-if="challengeCards.length"
          :cards="challengeCards"
          :challenge-stage-class="challengeStageClass"
        />
        <view v-else class="home-empty">当前还没有可关注的约队机会。你可以去大厅发布一条，或等待其他球队发起。</view>

        <template v-if="!isGuestMode">
          <view class="section-headline">
            <view>
              <text class="section-headline-title">球队数据</text>
              <text class="section-caption">首页只展示今年以来真实出勤摘要。</text>
            </view>
            <view class="section-link" @tap="openTab('/pages/teams/index')">查看统计</view>
          </view>

        <HomeDigestGrid :digest="personalDigest" />
        </template>
      </view>
    </view>

    <BottomTabBar current="home" />
  </view>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  padding: 0 28rpx 164rpx;
  background:
    radial-gradient(circle at top left, rgba(200, 255, 0, 0.12), transparent 24%),
    linear-gradient(180deg, #ffffff 0%, #f4f5f0 100%);
  box-sizing: border-box;
}

.home-content {
  position: relative;
}

.home-refresh-mask {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 8;
  display: flex;
  justify-content: flex-end;
  width: 100%;
  pointer-events: none;
}

.home-refresh-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 132rpx;
  height: 48rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: rgba(17, 17, 17, 0.88);
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 800;
  box-shadow: 0 12rpx 24rpx rgba(17, 17, 17, 0.16);
}

.section-headline {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 30rpx;
}

.section-headline-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.section-fire {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  border-radius: 999rpx;
  background: #ffefe4;
  color: #ff6422;
  font-size: 22rpx;
  font-weight: 900;
}

.section-headline-title {
  display: block;
  font-size: 40rpx;
  color: #111111;
  font-weight: 900;
}

.section-caption {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #656a62;
  line-height: 1.5;
}

.section-link {
  color: #171814;
  font-size: 28rpx;
  font-weight: 800;
}

.home-empty {
  margin-top: 24rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  background: #ffffff;
  color: #676c64;
  font-size: 28rpx;
  line-height: 1.6;
}
</style>
