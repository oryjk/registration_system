<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
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
      <view v-if="showInitialLoadingState" class="home-skeleton-stack">
        <view class="home-skeleton-card home-skeleton-card-hero">
          <view class="home-skeleton-row">
            <view class="home-skeleton-avatar" />
            <view class="home-skeleton-copy">
              <view class="home-skeleton-line home-skeleton-line-title" />
              <view class="home-skeleton-line home-skeleton-line-body" />
            </view>
          </view>
          <view class="home-skeleton-pill" />
        </view>

        <view class="home-skeleton-card home-skeleton-card-banner" />

        <view class="home-skeleton-headline">
          <view class="home-skeleton-line home-skeleton-line-section" />
          <view class="home-skeleton-line home-skeleton-line-link" />
        </view>

        <view class="home-skeleton-card home-skeleton-card-match">
          <view class="home-skeleton-line home-skeleton-line-title" />
          <view class="home-skeleton-line home-skeleton-line-body" />
          <view class="home-skeleton-line home-skeleton-line-body" />
          <view class="home-skeleton-progress" />
        </view>

        <view class="home-skeleton-headline">
          <view class="home-skeleton-line home-skeleton-line-section" />
          <view class="home-skeleton-line home-skeleton-line-link" />
        </view>

        <view class="home-skeleton-card home-skeleton-card-opportunity">
          <view class="home-skeleton-line home-skeleton-line-title" />
          <view class="home-skeleton-line home-skeleton-line-body" />
          <view class="home-skeleton-line home-skeleton-line-body short" />
        </view>
      </view>

      <view v-else>
        <view v-if="isRefreshing" class="home-refresh-mask">
          <view class="home-refresh-chip">更新中...</view>
        </view>

        <view v-if="!isGuestMode" class="team-hero-card">
          <view class="team-hero-main">
            <view class="team-hero-logo">
              <image
                v-if="teamLogoUrl"
                class="team-hero-logo-image"
                :src="teamLogoUrl"
                mode="aspectFill"
              />
              <text v-else class="team-hero-logo-text">{{ teamInitial }}</text>
            </view>
            <view class="team-hero-copy">
              <view class="team-hero-title-row">
                <text class="team-hero-name">{{ currentTeam?.name || "我的球队" }}</text>
                <text v-if="currentTeam" class="team-hero-role">{{ currentTeam.myRoleLabel }}</text>
              </view>
              <text class="team-hero-meta">{{ teamMetaLine }}</text>
            </view>
          </view>
          <view class="team-hero-button" @tap="handleManageTap">{{ manageButtonLabel }}</view>
        </view>

        <view class="home-banner" @tap="openTab('/pages/activities/index')">
          <view class="home-banner-copy">
            <text class="home-banner-title">约球开踢</text>
            <text class="home-banner-subtitle">组队 · 报名 · 上场</text>
            <view class="home-banner-button">去看看</view>
          </view>
          <view class="home-banner-goal">GOAL!</view>
          <view class="home-banner-net" />
          <view class="home-banner-ball" />
        </view>

        <view class="section-headline">
          <view class="section-headline-left">
            <text class="section-fire">热</text>
            <text class="section-headline-title">最近要处理的比赛</text>
          </view>
          <view class="section-link" @tap="openTab('/pages/teams/index')">全部比赛</view>
        </view>

        <view v-if="teamMatches.length" class="match-list">
          <view
            v-for="match in teamMatches"
            :key="match.id"
            :class="['home-match-card', navigatingMatchId === match.id ? 'home-match-card-tapping' : '']"
            @tap="handleMatchTap(match)"
          >
            <view class="home-match-date">
              <text class="home-match-month">{{ formatMatchDateBlock(match.dateLabel).monthDay }}</text>
              <text class="home-match-weekday">{{ formatMatchDateBlock(match.dateLabel).weekday }}</text>
              <view class="home-match-time-chip">
                <text class="home-match-time">{{ formatMatchDateBlock(match.dateLabel).timeLabel }}</text>
                <text class="home-match-time-note">截止报名</text>
              </view>
            </view>

            <view class="home-match-body">
              <view class="home-match-title-row">
                <text class="home-match-title">{{ match.title }}</text>
                <view class="home-match-tags">
                  <text :class="signupScopeClass(match.signupScope)">{{ match.signupScopeLabel }}</text>
                  <text :class="stageClass(match.stage)">{{ match.stage }}</text>
                </view>
              </view>
              <text class="home-match-meta">{{ match.venue }}</text>
              <text class="home-match-meta">{{ match.formatLabel }} · 对手 {{ match.opponent }}</text>

              <view class="home-progress-row">
                <text class="home-progress-label">报名进度</text>
                <text class="home-progress-value">{{ match.joinedPlayers }}/{{ match.requiredPlayers }}</text>
              </view>
              <view class="home-progress-track">
                <view class="home-progress-fill" :style="{ width: progressBaseWidth(match.joinedPlayers, match.requiredPlayers, match.maxPlayers) }" />
                <view
                  class="home-progress-fill-extra"
                  :style="{
                    left: progressSplitLeft(match.requiredPlayers, match.maxPlayers),
                    width: progressExtraWidth(match.joinedPlayers, match.requiredPlayers, match.maxPlayers),
                  }"
                />
                <view class="home-progress-split" :style="{ left: progressSplitLeft(match.requiredPlayers, match.maxPlayers) }" />
              </view>

              <view class="home-avatars-row">
                <view class="home-avatars">
                  <view
                    v-for="avatar in match.participantAvatars"
                    :key="avatar.userId"
                    class="home-avatar"
                    :style="{ backgroundColor: avatar.tone }"
                  >
                    <image
                      v-if="avatar.avatarUrl"
                      class="home-avatar-image"
                      :src="avatar.avatarUrl"
                      mode="aspectFill"
                    />
                    <text v-else class="home-avatar-text">{{ avatar.displayText }}</text>
                  </view>
                </view>
                <text class="home-avatar-summary">{{ match.remainingPlayersLabel }}</text>
              </view>

              <view class="home-match-bottom">
                <text v-if="!isGuestMode" :class="statusClass(match.myStatus)">我的状态：{{ match.myStatus }}</text>
                <text v-else class="home-status home-status-pending">登录后报名</text>
                <view :class="['home-match-button', !match.canRegister ? 'home-match-button-disabled' : '']">
                  {{ match.canRegister ? "去报名" : "已满员" }}
                </view>
              </view>
            </view>
          </view>
        </view>
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

        <view v-if="challengeCards.length" class="opportunity-card">
          <view
            v-for="card in challengeCards"
            :key="card.id"
            class="opportunity-item"
          >
            <view class="opportunity-copy">
              <text class="opportunity-title">{{ card.title }}</text>
              <text class="opportunity-meta">{{ card.hostTeamName }} · {{ card.monthDayLabel }} {{ card.weekdayLabel }} {{ card.timeRangeLabel }}</text>
              <text class="opportunity-meta">{{ card.venue }}</text>
            </view>
            <view class="opportunity-side">
              <text class="opportunity-score">{{ card.creditScore }} 分</text>
              <text :class="challengeStageClass(card.statusTone)">{{ card.statusLabel }}</text>
            </view>
          </view>
        </view>
        <view v-else class="home-empty">当前还没有可关注的约队机会。你可以去大厅发布一条，或等待其他球队发起。</view>

        <template v-if="!isGuestMode">
          <view class="section-headline">
            <view>
              <text class="section-headline-title">球队数据</text>
              <text class="section-caption">首页只展示今年以来真实出勤摘要。</text>
            </view>
            <view class="section-link" @tap="openTab('/pages/teams/index')">查看统计</view>
          </view>

        <view class="digest-grid">
          <view class="digest-card">
            <text class="digest-value">{{ personalDigest.attendanceRate }}</text>
            <text class="digest-label">出勤率</text>
          </view>
          <view class="digest-card">
            <text class="digest-value">{{ personalDigest.attended }}</text>
            <text class="digest-label">参加</text>
          </view>
          <view class="digest-card">
            <text class="digest-value">{{ personalDigest.leave }}</text>
            <text class="digest-label">请假</text>
          </view>
          <view class="digest-card">
            <text class="digest-value">{{ personalDigest.late }}</text>
            <text class="digest-label">缺席</text>
          </view>
        </view>
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

.home-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 16rpx;
}

.home-skeleton-card,
.home-skeleton-headline,
.home-skeleton-line,
.home-skeleton-avatar,
.home-skeleton-pill,
.home-skeleton-progress {
  position: relative;
  overflow: hidden;
}

.home-skeleton-card::after,
.home-skeleton-headline::after,
.home-skeleton-line::after,
.home-skeleton-avatar::after,
.home-skeleton-pill::after,
.home-skeleton-progress::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.72) 50%, transparent 100%);
  animation: home-skeleton-shimmer 1.2s ease-in-out infinite;
}

.home-skeleton-card {
  border-radius: 28rpx;
  background: #eef2e8;
}

.home-skeleton-card-hero {
  min-height: 124rpx;
  padding: 18rpx 22rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22rpx;
}

.home-skeleton-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  flex: 1;
}

.home-skeleton-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 999rpx;
  background: #dde4d5;
  flex-shrink: 0;
}

.home-skeleton-copy {
  flex: 1;
}

.home-skeleton-line {
  height: 24rpx;
  border-radius: 999rpx;
  background: #dde4d5;
}

.home-skeleton-line + .home-skeleton-line {
  margin-top: 14rpx;
}

.home-skeleton-line-title {
  width: 44%;
  height: 30rpx;
}

.home-skeleton-line-body {
  width: 78%;
}

.home-skeleton-line-body.short {
  width: 56%;
}

.home-skeleton-line-section {
  width: 220rpx;
  height: 34rpx;
}

.home-skeleton-line-link {
  width: 120rpx;
  height: 28rpx;
}

.home-skeleton-pill {
  width: 136rpx;
  height: 56rpx;
  border-radius: 999rpx;
  background: #dde4d5;
  flex-shrink: 0;
}

.home-skeleton-card-banner {
  min-height: 194rpx;
}

.home-skeleton-headline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 10rpx;
}

.home-skeleton-card-match {
  min-height: 248rpx;
  padding: 24rpx;
}

.home-skeleton-progress {
  width: 100%;
  height: 16rpx;
  margin-top: 24rpx;
  border-radius: 999rpx;
  background: #dde4d5;
}

.home-skeleton-card-opportunity {
  min-height: 166rpx;
  padding: 24rpx;
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

@keyframes home-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}

.team-hero-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22rpx;
  margin-top: 16rpx;
  min-height: 124rpx;
  padding: 18rpx 22rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 20rpx 40rpx rgba(17, 17, 17, 0.06);
}

.team-hero-main {
  display: flex;
  align-items: center;
  gap: 20rpx;
  min-width: 0;
  flex: 1;
}

.team-hero-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  border-radius: 999rpx;
  background: #171717;
  flex-shrink: 0;
  overflow: hidden;
}

.team-hero-logo-image {
  width: 100%;
  height: 100%;
}

.team-hero-logo-text {
  color: #c8ff00;
  font-size: 34rpx;
  font-weight: 900;
}

.team-hero-copy {
  min-width: 0;
}

.team-hero-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.team-hero-name {
  font-size: 30rpx;
  color: #111111;
  font-weight: 900;
}

.team-hero-role {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #111111;
  font-size: 20rpx;
  font-weight: 900;
}

.team-hero-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 21rpx;
  color: #5f645c;
  line-height: 1.45;
}

.team-hero-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 136rpx;
  height: 56rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  border: 2rpx solid #111111;
  color: #111111;
  font-size: 22rpx;
  font-weight: 900;
  background: #ffffff;
  flex-shrink: 0;
}

.home-banner {
  position: relative;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  overflow: hidden;
  margin-top: 18rpx;
  min-height: 194rpx;
  padding: 24rpx 24rpx;
  border-radius: 24rpx;
  background:
    radial-gradient(circle at 30% 40%, rgba(200, 255, 0, 0.15), transparent 35%),
    linear-gradient(135deg, #121212 0%, #1d1d1c 58%, #262624 100%);
}

.home-banner::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1rpx, transparent 1rpx);
  background-size: 12rpx 12rpx;
  opacity: 0.35;
}

.home-banner-copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.home-banner-title {
  font-size: 60rpx;
  line-height: 1;
  color: #ffffff;
  font-weight: 900;
  letter-spacing: -3rpx;
}

.home-banner-subtitle {
  margin-top: 14rpx;
  font-size: 28rpx;
  color: #c8ff00;
  font-weight: 900;
}

.home-banner-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 136rpx;
  height: 54rpx;
  margin-top: 20rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #111111;
  font-size: 24rpx;
  font-weight: 900;
}

.home-banner-goal {
  position: absolute;
  top: 22rpx;
  right: 160rpx;
  z-index: 2;
  color: #c8ff00;
  font-size: 24rpx;
  font-style: italic;
  font-weight: 900;
  transform: rotate(-10deg);
}

.home-banner-net {
  position: absolute;
  right: 12rpx;
  top: 14rpx;
  z-index: 1;
  width: 188rpx;
  height: 150rpx;
  background:
    linear-gradient(120deg, transparent 0 18%, rgba(255,255,255,0.88) 18% 20%, transparent 20% 38%, rgba(255,255,255,0.88) 38% 40%, transparent 40% 58%, rgba(255,255,255,0.88) 58% 60%, transparent 60% 100%),
    linear-gradient(90deg, transparent 0 18%, rgba(255,255,255,0.88) 18% 20%, transparent 20% 38%, rgba(255,255,255,0.88) 38% 40%, transparent 40% 58%, rgba(255,255,255,0.88) 58% 60%, transparent 60% 100%);
  opacity: 0.9;
  clip-path: polygon(18% 0, 100% 0, 100% 100%, 48% 100%);
}

.home-banner-ball {
  position: absolute;
  right: 30rpx;
  bottom: -10rpx;
  z-index: 2;
  width: 154rpx;
  height: 154rpx;
  border-radius: 999rpx;
  background:
    radial-gradient(circle at 35% 35%, #ffffff 0%, #f0f0f0 38%, #1a1a1a 39%, #1a1a1a 48%, #f0f0f0 49%, #ffffff 62%, #d9d9d9 100%);
  box-shadow: inset -16rpx -18rpx 30rpx rgba(0, 0, 0, 0.18);
  transform: rotate(-18deg);
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

.match-list {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  margin-top: 22rpx;
}

.home-match-card {
  display: flex;
  gap: 18rpx;
  padding: 20rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 22rpx 44rpx rgba(17, 17, 17, 0.06);
}

.home-match-card-tapping {
  opacity: 0.76;
}

.home-match-date {
  width: 156rpx;
  flex-shrink: 0;
  min-height: 240rpx;
  padding: 18rpx 16rpx;
  border-radius: 24rpx;
  background: #1b1b1b;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.home-match-month {
  font-size: 28rpx;
  opacity: 0.92;
  font-weight: 700;
}

.home-match-weekday {
  margin-top: 8rpx;
  font-size: 48rpx;
  font-weight: 900;
}

.home-match-time-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: auto;
  padding: 18rpx 8rpx;
  border-radius: 22rpx;
  background: #c8ff00;
  color: #111111;
}

.home-match-time {
  font-size: 38rpx;
  font-weight: 900;
}

.home-match-time-note {
  margin-top: 6rpx;
  font-size: 20rpx;
  font-weight: 800;
}

.home-match-body {
  flex: 1;
  min-width: 0;
}

.home-match-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.home-match-title {
  flex: 1;
  font-size: 32rpx;
  line-height: 1.3;
  color: #111111;
  font-weight: 900;
}

.home-match-tags {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
}

.home-scope,
.home-stage {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 800;
}

.home-scope-internal {
  background: #eef8d6;
  color: #486600;
}

.home-scope-external {
  background: #171814;
  color: #c8ff00;
}

.home-stage-red {
  background: #ffe9ea;
  color: #d34c61;
}

.home-stage-blue {
  background: #ecf0ff;
  color: #4663d4;
}

.home-stage-dark {
  background: #eceee8;
  color: #4d534b;
}

.home-stage-muted {
  background: #f0f1ed;
  color: #7c8178;
}

.home-match-meta {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  line-height: 1.5;
  color: #5d625b;
}

.home-progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20rpx;
}

.home-progress-label,
.home-progress-value {
  font-size: 26rpx;
  font-weight: 700;
  color: #1d1e1b;
}

.home-progress-track {
  position: relative;
  width: 100%;
  height: 16rpx;
  margin-top: 10rpx;
  border-radius: 999rpx;
  background: #e9ece2;
  overflow: hidden;
}

.home-progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #b6ff00 0%, #d6ff5e 100%);
}

.home-progress-fill-extra {
  position: absolute;
  top: 0;
  height: 100%;
  background: #ff4d3d;
}

.home-progress-split {
  position: absolute;
  top: -3rpx;
  width: 4rpx;
  height: 22rpx;
  border-radius: 999rpx;
  background: #ffffff;
  box-shadow: 0 0 0 2rpx rgba(17, 17, 17, 0.06);
  transform: translateX(-50%);
}

.home-avatars-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 14rpx;
}

.home-avatars {
  display: flex;
  align-items: center;
}

.home-avatar {
  width: 42rpx;
  height: 42rpx;
  margin-left: -10rpx;
  border-radius: 999rpx;
  border: 4rpx solid #ffffff;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.home-avatar:first-child {
  margin-left: 0;
}

.home-avatar-image {
  width: 100%;
  height: 100%;
}

.home-avatar-text {
  color: #ffffff;
  font-size: 18rpx;
  font-weight: 800;
}

.home-avatar-summary {
  font-size: 24rpx;
  color: #51584f;
  font-weight: 700;
}

.home-match-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-top: 22rpx;
}

.home-status {
  padding: 14rpx 18rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 800;
}

.home-status-join {
  background: #eef8d6;
  color: #426000;
}

.home-status-leave {
  background: #f2f3ef;
  color: #5d625b;
}

.home-status-late {
  background: #fff1df;
  color: #ad6700;
}

.home-status-pending {
  background: #eceef4;
  color: #5c6274;
}

.home-match-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 150rpx;
  height: 62rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: #111111;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 900;
}

.home-match-button-disabled {
  background: #d7dcd0;
  color: #686d64;
}

.opportunity-card {
  margin-top: 22rpx;
  padding: 18rpx 24rpx;
  border-radius: 34rpx;
  background: #ffffff;
  box-shadow: 0 22rpx 44rpx rgba(17, 17, 17, 0.06);
}

.opportunity-item + .opportunity-item {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 2rpx solid #f0f2eb;
}

.opportunity-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.opportunity-copy {
  min-width: 0;
  flex: 1;
}

.opportunity-title {
  display: block;
  font-size: 34rpx;
  line-height: 1.4;
  color: #111111;
  font-weight: 900;
}

.opportunity-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #61665e;
  line-height: 1.5;
}

.opportunity-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10rpx;
}

.opportunity-score {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #f2f7db;
  color: #4e6800;
  font-size: 24rpx;
  font-weight: 900;
}

.challenge-pill {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 800;
}

.challenge-pill-lime {
  background: #eff8d3;
  color: #4b6700;
}

.challenge-pill-blue {
  background: #ebefff;
  color: #4966d3;
}

.challenge-pill-red {
  background: #ffe9ed;
  color: #ce4760;
}

.digest-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 22rpx;
}

.digest-card {
  padding: 26rpx 18rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 18rpx 36rpx rgba(17, 17, 17, 0.05);
}

.digest-value {
  display: block;
  font-size: 48rpx;
  color: #111111;
  font-weight: 900;
}

.digest-label {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #666b63;
  font-weight: 700;
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
