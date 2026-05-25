<script setup lang="ts">
import { computed, ref } from "vue";
import { onHide, onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import HomeDigestGrid from "./components/HomeDigestGrid.vue";
import HomeHeroSection from "./components/HomeHeroSection.vue";
import HomeMatchList from "./components/HomeMatchList.vue";
import HomeOpportunityList from "./components/HomeOpportunityList.vue";
import HomeSkeleton from "./components/HomeSkeleton.vue";
import { getActivityUsers, listActivities } from "@/api/activity";
import { acceptChallenge, cancelIndividualChallengeAcceptance, listChallenges } from "@/api/challenge";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { getMyActivities, getMyAttendance, listUsers } from "@/api/user";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";
import { getAccessToken, hasManualLogout } from "@/utils/authStorage";
import { isRuntimeVisibleActivity, isRuntimeVisibleChallengeSummary, loadMiniAppRuntimeConfig } from "@/config/runtimeConfig";
import { getCurrentYearDateRange } from "@/utils/dateRange";
import { DEFAULT_SHARE_IMAGE_URL } from "@/utils/share";
import { buildAttendanceSummary, buildChallengeCards, buildHomeMatchCards, buildJoinedIndividualHomeMatchCards } from "@/utils/viewModels";
import { formatWeekdayLabel } from "@/utils/datetime";
import { activityStageTone, attendanceStatusTone } from "@/utils/statusTone";
import type { ChallengeCardViewModel, HomeMatchCardViewModel } from "@/types/viewModels";
import type { BackendChallenge, BackendChallengeSummary, BackendMiniAppHomeHeroBanner, BackendUser } from "@/types/backend";

const { currentTeam, ensureSessionReady } = useTeamContext();
const { syncUnreadCount } = useNotificationCenter();

const isLoading = ref(false);
const isRefreshing = ref(false);
const hasLoadedOnce = ref(false);
const errorMessage = ref("");
const isGuestMode = ref(false);
const navigatingMatchId = ref("");
const hiddenAt = ref<number | null>(null);
const pendingReloadFromEvent = ref(false);
const HIDDEN_RELOAD_THRESHOLD_MS = 2 * 60 * 1000;
const submitting = ref(false);
const teamMatches = ref<HomeMatchCardViewModel[]>([]);
const rawTeamMatchCards = ref<HomeMatchCardViewModel[]>([]);
const challengeCards = ref<ChallengeCardViewModel[]>([]);
const rawChallengeSummaries = ref<BackendChallengeSummary[]>([]);
const homeHeroBanners = ref<BackendMiniAppHomeHeroBanner[]>([]);
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
const shouldShowMatchSection = computed(() => isGuestMode.value || !!currentTeam.value || teamMatches.value.length > 0);
const showMatchSectionLink = computed(() => !isGuestMode.value && (!!currentTeam.value || teamMatches.value.length > 0));
const matchSectionTitle = computed(() => "最近要处理的比赛");
const matchSectionLinkLabel = computed(() => (currentTeam.value ? "全部比赛" : "进入大厅"));
const matchEmptyText = computed(() => {
  if (isGuestMode.value) return "登录后可以查看最近要处理的比赛";
  if (!currentTeam.value) return "";
  return "当前球队还没有可展示的比赛，等后台录入活动后这里会自动刷新。";
});
const opportunityCaption = computed(() => {
  if (isGuestMode.value) return "公开约队可先浏览，接约和报名需要登录。";
  if (!currentTeam.value) return "可报名的散人约队会在这里展示。";
  return "只看当前球队值得优先关注的真实约队。";
});
const teamMetaLine = computed(() => {
  if (!currentTeam.value) {
    return "登录后加载当前球队信息";
  }

  return `${currentTeam.value.creditScore} 分信用 · 近期 ${teamMatches.value.length} 场待处理比赛`;
});
const manageButtonLabel = computed(() => (currentTeam.value?.canManageTeam ? "球队管理" : "我的"));
const shareTitle = "约球开踢：组队、报名、上场";
const sharePath = "/pages/home/index";

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
  return `home-status home-status-${attendanceStatusTone(status)}`;
}

function stageClass(stage: string) {
  return `home-stage home-stage-${activityStageTone(stage)}`;
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
  teamMatches.value = [];
  challengeCards.value = [];
  rawTeamMatchCards.value = [];
}

function sortChallengeSummariesByHoldingTimeDesc(summaries: BackendChallengeSummary[]) {
  return [...summaries].sort((left, right) => {
    const dateOrder = right.challenge.holding_date.localeCompare(left.challenge.holding_date);
    if (dateOrder !== 0) return dateOrder;
    return right.challenge.start_time.localeCompare(left.challenge.start_time);
  });
}

function buildVisibleChallengeCards(
  summaries: BackendChallengeSummary[],
  runtimeConfig: Awaited<ReturnType<typeof loadMiniAppRuntimeConfig>>,
  now: Date,
) {
  return buildChallengeCards(
    sortChallengeSummariesByHoldingTimeDesc(
      summaries.filter((summary) => isRuntimeVisibleChallengeSummary(summary, runtimeConfig, now)),
    ),
  ).slice(0, runtimeConfig.home.challenge_card_limit);
}

function rebuildOpportunityCards(runtimeConfig: Awaited<ReturnType<typeof loadMiniAppRuntimeConfig>>, now: Date) {
  challengeCards.value = buildVisibleChallengeCards(rawChallengeSummaries.value, runtimeConfig, now);
}

function rebuildChallengeDerivedHomeCards(runtimeConfig: Awaited<ReturnType<typeof loadMiniAppRuntimeConfig>>, now: Date) {
  rebuildOpportunityCards(runtimeConfig, now);

  if (isGuestMode.value) return;

  const joinedIndividualCards = buildJoinedIndividualTodos(rawChallengeSummaries.value, runtimeConfig, now);
  if (!currentTeam.value) {
    teamMatches.value = joinedIndividualCards;
    return;
  }

  teamMatches.value = sortHomeMatchCardsByDate([...rawTeamMatchCards.value, ...joinedIndividualCards]).slice(
    0,
    runtimeConfig.home.match_card_limit,
  );
}

function applyAcceptedChallengeState(challenge: BackendChallenge, card: ChallengeCardViewModel) {
  rawChallengeSummaries.value = rawChallengeSummaries.value.map((summary) => {
    if (summary.challenge.id !== challenge.id) return summary;

    const isIndividual = challenge.kind === "individual";
    const isTeamReservedByCurrentTeam =
      !isIndividual &&
      challenge.status === "open" &&
      challenge.host_team_id === currentTeam.value?.id &&
      !challenge.guest_team_id;

    return {
      ...summary,
      challenge,
      host_team_name: isTeamReservedByCurrentTeam ? currentTeam.value?.name ?? summary.host_team_name : summary.host_team_name,
      host_team_credit_score: isTeamReservedByCurrentTeam ? currentTeam.value?.creditScore ?? summary.host_team_credit_score : summary.host_team_credit_score,
      host_team_trust_label: isTeamReservedByCurrentTeam ? currentTeam.value?.trustLabel ?? summary.host_team_trust_label : summary.host_team_trust_label,
      guest_team_name: isIndividual || isTeamReservedByCurrentTeam ? summary.guest_team_name : currentTeam.value?.name ?? summary.guest_team_name,
      guest_team_credit_score: isIndividual || isTeamReservedByCurrentTeam ? summary.guest_team_credit_score : currentTeam.value?.creditScore ?? summary.guest_team_credit_score,
      guest_team_trust_label: isIndividual || isTeamReservedByCurrentTeam ? summary.guest_team_trust_label : currentTeam.value?.trustLabel ?? summary.guest_team_trust_label,
      current_team_relation: isIndividual ? summary.current_team_relation : isTeamReservedByCurrentTeam ? "host" : "guest",
      accepted_count: isIndividual ? summary.accepted_count + 1 : summary.accepted_count,
      current_user_joined: isIndividual ? true : summary.current_user_joined,
      can_accept: false,
    };
  });

  if (challenge.activity_id && challenge.status === "matched") {
    openMatchDetail(challenge.activity_id);
    return;
  }

  if (card.kind !== "individual") {
    syncUnreadCount({ skipEnsure: true });
  }
}

function applyCancelledIndividualChallengeState(challenge: BackendChallenge) {
  rawChallengeSummaries.value = rawChallengeSummaries.value.map((summary) => {
    if (summary.challenge.id !== challenge.id) return summary;

    return {
      ...summary,
      challenge,
      accepted_count: Math.max(summary.accepted_count - 1, 0),
      current_user_joined: false,
      can_accept: challenge.status === "open",
    };
  });
}

function buildJoinedIndividualTodos(
  summaries: BackendChallengeSummary[],
  runtimeConfig: Awaited<ReturnType<typeof loadMiniAppRuntimeConfig>>,
  now: Date,
) {
  return buildJoinedIndividualHomeMatchCards({
    summaries: summaries.filter((summary) => isRuntimeVisibleChallengeSummary(summary, runtimeConfig, now)),
    limit: runtimeConfig.home.match_card_limit,
  });
}

function sortHomeMatchCardsByDate(cards: HomeMatchCardViewModel[]) {
  return [...cards].sort((left, right) => left.dateLabel.localeCompare(right.dateLabel));
}

async function loadOpportunityCards(options?: {
  auth?: boolean;
}) {
  const runtimeConfig = await loadMiniAppRuntimeConfig();
  homeHeroBanners.value = runtimeConfig.home.hero_banners;
  const now = new Date();
  const challengeFetchLimit = Math.min(runtimeConfig.home.challenge_card_limit * 5, 50);
  const challengeSummaries = await listChallenges({ limit: challengeFetchLimit, sort: "holding_date_desc", auth: options?.auth ?? false });
  rawChallengeSummaries.value = challengeSummaries;
  rebuildChallengeDerivedHomeCards(runtimeConfig, now);
}

function openTab(path: string) {
  uni.switchTab({ url: path });
}

function openAllPendingMatches() {
  if (!currentTeam.value) {
    uni.switchTab({ url: "/pages/activities/index" });
    return;
  }
  uni.navigateTo({ url: "/pages/home/matches/index" });
}

function openChallengeDetail(challengeId: string) {
  uni.navigateTo({
    url: `/pages/challenges/detail?id=${challengeId}`,
  });
}

function openMatchDetail(activityId: string) {
  uni.navigateTo({
    url: `/pages/matches/detail?id=${activityId}`,
  });
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
    url: match.detailUrl,
    fail: () => {
      navigatingMatchId.value = "";
    },
  });
}

async function handleOpportunityPrimaryAction(card: ChallengeCardViewModel) {
  if (card.activityId && card.statusTone === "matched") {
    openMatchDetail(card.activityId);
    return;
  }

  if (card.kind === "individual" && card.currentUserJoined) {
    await handleCancelIndividualAcceptance(card);
    return;
  }

  if (card.kind === "individual" && card.statusTone === "open") {
    await handleAcceptChallenge(card);
    return;
  }

  if (card.canAccept) {
    await handleAcceptChallenge(card);
    return;
  }

  openChallengeDetail(card.id);
}

async function handleCancelIndividualAcceptance(card: ChallengeCardViewModel) {
  if (submitting.value || card.kind !== "individual" || !card.currentUserJoined) return;

  uni.showModal({
    title: "确认取消报名",
    content: `确认取消「${card.title}」的报名？取消后可重新报名。`,
    confirmText: "取消报名",
    cancelText: "再想想",
    success: async (result) => {
      if (!result.confirm) return;
      submitting.value = true;
      try {
        const challenge = await cancelIndividualChallengeAcceptance(card.id);
        applyCancelledIndividualChallengeState(challenge);
        const runtimeConfig = await loadMiniAppRuntimeConfig();
        homeHeroBanners.value = runtimeConfig.home.hero_banners;
        rebuildChallengeDerivedHomeCards(runtimeConfig, new Date());
        uni.showToast({
          title: "已取消报名",
          icon: "none",
        });
      } catch (error) {
        uni.showToast({
          title: error instanceof Error ? error.message : "取消报名失败",
          icon: "none",
        });
      } finally {
        submitting.value = false;
      }
    },
  });
}

async function handleAcceptChallenge(card: ChallengeCardViewModel) {
  if (submitting.value) return;
  if (card.kind === "team" && (!currentTeam.value || !currentTeam.value.canManageTeam)) return;

  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: card.kind === "team" ? "确认接约" : "确认报名",
      content:
        card.kind === "team"
          ? `确认以当前球队接约「${card.title}」？`
          : `确认报名参加「${card.title}」？`,
      confirmText: card.kind === "team" ? "确认接约" : "确认报名",
      cancelText: "再想想",
      success: (result) => resolve(!!result.confirm),
      fail: () => resolve(false),
    });
  });
  if (!confirmed) return;

  submitting.value = true;
  try {
    const challenge = await acceptChallenge(card.id, card.kind === "team" ? currentTeam.value?.id : undefined);
    applyAcceptedChallengeState(challenge, card);
    const runtimeConfig = await loadMiniAppRuntimeConfig();
    homeHeroBanners.value = runtimeConfig.home.hero_banners;
    rebuildChallengeDerivedHomeCards(runtimeConfig, new Date());
    uni.showToast({
      title: card.kind === "team" ? "接约成功" : "报名成功",
      icon: "none",
    });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "接约失败",
      icon: "none",
    });
  } finally {
    submitting.value = false;
  }
}

function formatMatchDateBlock(dateLabel: string) {
  const [monthDay, timeLabel] = dateLabel.split(" ");
  const [month, day] = monthDay.split("/");
  const weekday = formatWeekdayLabel(`2026-${month}-${day}T00:00:00`);
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
    if (hasManualLogout() || !getAccessToken()) {
      isGuestMode.value = true;
      resetUserRelatedHomeData();
      teamMatches.value = [];
      await loadOpportunityCards();
      hasLoadedOnce.value = true;
      return;
    }

    isGuestMode.value = false;
    await ensureSessionReady();
    if (!currentTeam.value) {
      resetUserRelatedHomeData();
      const runtimeConfig = await loadMiniAppRuntimeConfig();
      homeHeroBanners.value = runtimeConfig.home.hero_banners;
      const now = new Date();
      const challengeFetchLimit = Math.min(runtimeConfig.home.challenge_card_limit * 5, 50);
      const challengeSummaries = await listChallenges({ limit: challengeFetchLimit, sort: "holding_date_desc", auth: true });
      rawChallengeSummaries.value = challengeSummaries;
      rawTeamMatchCards.value = [];
      rebuildChallengeDerivedHomeCards(runtimeConfig, now);
      hasLoadedOnce.value = true;
      return;
    }

    const runtimeConfig = await loadMiniAppRuntimeConfig();
    homeHeroBanners.value = runtimeConfig.home.hero_banners;
    const now = new Date();
    const attendanceDateRange = getCurrentYearDateRange(now);
    const challengeFetchLimit = Math.min(runtimeConfig.home.challenge_card_limit * 5, 50);
    const [activityPage, myActivityRecords, attendanceRecords, challengeSummaries, users] = await Promise.all([
      listActivities({ page: 1, pageSize: runtimeConfig.home.activity_fetch_page_size }),
      getMyActivities(),
      getMyAttendance(attendanceDateRange),
      listChallenges({ teamId: currentTeam.value.id, limit: challengeFetchLimit, sort: "holding_date_desc" }),
      listUsers(),
      syncUnreadCount({ skipEnsure: true }),
    ]);
    rawChallengeSummaries.value = challengeSummaries;
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

    const teamMatchCards = buildHomeMatchCards({
      teamId: currentTeam.value.id,
      activities: focusedActivities,
      myActivityRecords,
      registrationsByActivityId,
      teamRegistrationCountsByActivityId,
      usersById,
      limit: runtimeConfig.home.match_card_limit,
    });
    rawTeamMatchCards.value = teamMatchCards;
    rebuildChallengeDerivedHomeCards(runtimeConfig, now);

    const summary = buildAttendanceSummary(attendanceRecords);
    personalDigest.value = {
      attendanceRate: summary.attendanceRate,
      attended: summary.attended,
      leave: summary.leave,
      late: summary.late,
    };
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

function handleHomeDataMayChanged() {
  pendingReloadFromEvent.value = true;
}

onShow(() => {
  uni.hideTabBar({ animation: false });

  if (!hasLoadedOnce.value) {
    void loadPageData();
    return;
  }

  if (pendingReloadFromEvent.value) {
    pendingReloadFromEvent.value = false;
    hiddenAt.value = null;
    void loadPageData({ preserveContent: true });
    return;
  }

  const hiddenDuration = hiddenAt.value === null ? 0 : Date.now() - hiddenAt.value;
  hiddenAt.value = null;
  if (hiddenDuration < HIDDEN_RELOAD_THRESHOLD_MS) return;
  void loadPageData({ preserveContent: true });
});

onHide(() => {
  hiddenAt.value = Date.now();
  if (navigatingMatchId.value) {
    navigatingMatchId.value = "";
  }
});

onPullDownRefresh(async () => {
  try {
    await loadPageData({ preserveContent: hasLoadedOnce.value });
  } finally {
    uni.stopPullDownRefresh();
  }
});

onLoad(() => {
  uni.$on("session:login-completed", handleSessionLoginCompleted);
  uni.$on("home:data-may-changed", handleHomeDataMayChanged);
});

onUnload(() => {
  uni.$off("session:login-completed", handleSessionLoginCompleted);
  uni.$off("home:data-may-changed", handleHomeDataMayChanged);
});

onShareAppMessage(() => ({
  title: shareTitle,
  path: sharePath,
  imageUrl: DEFAULT_SHARE_IMAGE_URL,
}));

onShareTimeline(() => ({
  title: shareTitle,
  query: "",
  imageUrl: DEFAULT_SHARE_IMAGE_URL,
}));
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
          :hero-banners="homeHeroBanners"
          @manage-tap="handleManageTap"
          @banner-tap="openTab('/pages/activities/index')"
        />

        <view v-if="shouldShowMatchSection" class="section-headline">
          <view class="section-headline-left">
            <text class="section-fire">热</text>
            <text class="section-headline-title">{{ matchSectionTitle }}</text>
          </view>
          <view v-if="showMatchSectionLink" class="section-link" @tap="openAllPendingMatches">{{ matchSectionLinkLabel }}</view>
        </view>

        <HomeMatchList
          v-if="shouldShowMatchSection && teamMatches.length"
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
        <view v-else-if="shouldShowMatchSection" class="home-empty">
          {{ matchEmptyText }}
        </view>

        <view class="section-headline">
          <view>
            <text class="section-headline-title">约队机会</text>
            <text class="section-caption">
              {{ opportunityCaption }}
            </text>
          </view>
          <view class="section-link" @tap="openTab('/pages/activities/index')">进入大厅</view>
        </view>

        <HomeOpportunityList
          v-if="challengeCards.length"
          :cards="challengeCards"
          :challenge-stage-class="challengeStageClass"
          :submitting="submitting"
          @open-challenge="openChallengeDetail"
          @primary-action="handleOpportunityPrimaryAction"
        />
        <view v-else class="home-empty">当前还没有可关注的约队机会。你可以去大厅发布一条，或等待其他球队发起。</view>

        <template v-if="currentTeam">
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
    radial-gradient(circle at top left, rgba(155, 226, 43, 0.16), transparent 24%),
    linear-gradient(180deg, #ffffff 0%, #f5f7f1 48%, #eef2e9 100%);
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
  background: rgba(23, 32, 24, 0.9);
  color: #fffdf8;
  font-size: 22rpx;
  font-weight: 700;
  box-shadow: 0 12rpx 24rpx rgba(43, 55, 38, 0.18);
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
  background: #fff0df;
  color: #e86d37;
  font-size: 22rpx;
  font-weight: 800;
}

.section-headline-title {
  display: block;
  font-size: 38rpx;
  line-height: 1.15;
  color: #172018;
  font-weight: 800;
}

.section-caption {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #5f685b;
  line-height: 1.55;
}

.section-link {
  color: #172018;
  font-size: 28rpx;
  font-weight: 700;
}

.home-empty {
  margin-top: 24rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  background: #fffdf8;
  color: #5f685b;
  font-size: 28rpx;
  line-height: 1.6;
}
</style>
