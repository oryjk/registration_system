<script setup lang="ts">
import { computed, ref } from "vue";
import { onHide, onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import { NeoSectionHeader } from "@/components/neo";
import HomeHeroSection from "./components/HomeHeroSection.vue";
import HomeMatchList from "./components/HomeMatchList.vue";
import HomeOpportunityList from "./components/HomeOpportunityList.vue";
import HomeSkeleton from "./components/HomeSkeleton.vue";
import { getActivityUsers, listActivities } from "@/api/activity";
import { acceptChallenge, cancelIndividualChallengeAcceptance, listChallenges } from "@/api/challenge";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { getMyActivities, listUsers } from "@/api/user";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";
import { getAccessToken, hasManualLogout } from "@/utils/authStorage";
import { isRuntimeVisibleActivity, isRuntimeVisibleChallengeSummary, loadMiniAppRuntimeConfig } from "@/config/runtimeConfig";
import { DEFAULT_SHARE_IMAGE_URL } from "@/utils/share";
import { buildChallengeCards, buildHomeMatchCards, buildJoinedIndividualHomeMatchCards } from "@/utils/viewModels";
import { formatBackendDateTime, formatWeekdayLabel } from "@/utils/datetime";
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
let homeLoadVersion = 0;

type HomeRuntimeConfig = Awaited<ReturnType<typeof loadMiniAppRuntimeConfig>>;

type HomeDeferredHydrationContext = {
  loadVersion: number;
  teamId: number;
  focusedActivities: Awaited<ReturnType<typeof listActivities>>["items"];
  myActivityRecords: Awaited<ReturnType<typeof getMyActivities>>;
  registrationsByActivityId: Record<string, Awaited<ReturnType<typeof getActivityUsers>>>;
  teamRegistrationCountsByActivityId: Record<string, number>;
  runtimeConfig: HomeRuntimeConfig;
  now: Date;
};

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
  return "当前球队还没有可展示的比赛，等后台录入比赛后这里会自动刷新。";
});
const opportunityCaption = computed(() => {
  if (isGuestMode.value) return "公开约队可先浏览，接约和报名需要登录。";
  return "展示当前时间之后开始的约队比赛。";
});
const shareTitle = "约球开踢：组队、报名、上场";
const sharePath = "/pages/home/index";
const HOME_ACTIVITY_FETCH_BUFFER = 4;

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

function challengeStageClass(statusTone: ChallengeCardViewModel["statusTone"]) {
  if (statusTone === "matched") return "challenge-pill challenge-pill-blue";
  if (statusTone === "cancelled") return "challenge-pill challenge-pill-red";
  return "challenge-pill challenge-pill-lime";
}

function resetUserRelatedHomeData() {
  teamMatches.value = [];
  challengeCards.value = [];
  rawTeamMatchCards.value = [];
}

function sortChallengeSummariesByHoldingTimeAsc(summaries: BackendChallengeSummary[]) {
  return [...summaries].sort((left, right) => {
    const dateOrder = left.challenge.holding_date.localeCompare(right.challenge.holding_date);
    if (dateOrder !== 0) return dateOrder;
    return left.challenge.start_time.localeCompare(right.challenge.start_time);
  });
}

function buildVisibleChallengeCards(
  summaries: BackendChallengeSummary[],
  runtimeConfig: Awaited<ReturnType<typeof loadMiniAppRuntimeConfig>>,
  now: Date,
) {
  return buildChallengeCards(
    sortChallengeSummariesByHoldingTimeAsc(
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

async function hydrateDeferredHomeData(context: HomeDeferredHydrationContext) {
  void syncUnreadCount({ skipEnsure: true }).catch(() => {
    // Notification count is nice-to-have for the home screen; keep first paint independent from it.
  });

  const usersResult = await listUsers().then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ status: "rejected" as const, reason }),
  );

  if (context.loadVersion !== homeLoadVersion || currentTeam.value?.id !== context.teamId) {
    return;
  }

  if (usersResult.status === "fulfilled" && currentTeam.value?.id === context.teamId) {
    const usersById = Object.fromEntries(usersResult.value.map((item: BackendUser) => [item.id, item]));
    rawTeamMatchCards.value = buildHomeMatchCards({
      teamId: currentTeam.value.id,
      activities: context.focusedActivities,
      myActivityRecords: context.myActivityRecords,
      registrationsByActivityId: context.registrationsByActivityId,
      teamRegistrationCountsByActivityId: context.teamRegistrationCountsByActivityId,
      usersById,
      limit: context.runtimeConfig.home.match_card_limit,
    });
    rebuildChallengeDerivedHomeCards(context.runtimeConfig, context.now);
  }
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
  const challengeSummaries = await listChallenges({
    limit: challengeFetchLimit,
    sort: "holding_date_asc",
    startsAfter: formatBackendDateTime(now),
    auth: options?.auth ?? false,
  });
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

function handleMatchTap(match: HomeMatchCardViewModel) {
  if (navigatingMatchId.value) return;
  if (!match.canRegister) {
    uni.showToast({
      title: "本场暂不可报名",
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
  const loadVersion = ++homeLoadVersion;
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
      const challengeSummaries = await listChallenges({
        limit: challengeFetchLimit,
        sort: "holding_date_asc",
        startsAfter: formatBackendDateTime(now),
        auth: true,
      });
      rawChallengeSummaries.value = challengeSummaries;
      rawTeamMatchCards.value = [];
      rebuildChallengeDerivedHomeCards(runtimeConfig, now);
      hasLoadedOnce.value = true;
      return;
    }

    const runtimeConfig = await loadMiniAppRuntimeConfig();
    homeHeroBanners.value = runtimeConfig.home.hero_banners;
    const now = new Date();
    const activityFetchPageSize = Math.min(runtimeConfig.home.match_card_limit + HOME_ACTIVITY_FETCH_BUFFER, 12);
    const challengeFetchLimit = Math.min(runtimeConfig.home.challenge_card_limit * 5, 50);
    const [activityPage, myActivityRecords, challengeSummaries] = await Promise.all([
      listActivities({
        page: 1,
        pageSize: activityFetchPageSize,
        teamId: currentTeam.value.id,
        holdingAfter: formatBackendDateTime(now),
      }),
      getMyActivities(),
      listChallenges({
        limit: challengeFetchLimit,
        sort: "holding_date_asc",
        startsAfter: formatBackendDateTime(now),
        auth: true,
      }),
    ]);
    rawChallengeSummaries.value = challengeSummaries;
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
      limit: runtimeConfig.home.match_card_limit,
    });
    rawTeamMatchCards.value = teamMatchCards;
    rebuildChallengeDerivedHomeCards(runtimeConfig, now);
    hasLoadedOnce.value = true;
    void hydrateDeferredHomeData({
      loadVersion,
      teamId: currentTeam.value.id,
      focusedActivities,
      myActivityRecords,
      registrationsByActivityId,
      teamRegistrationCountsByActivityId,
      runtimeConfig,
      now,
    });
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
          :hero-banners="homeHeroBanners"
          @banner-tap="openTab('/pages/activities/index')"
        />

        <NeoSectionHeader
          v-if="shouldShowMatchSection"
          :title="matchSectionTitle"
          marker="热"
          :action-label="showMatchSectionLink ? matchSectionLinkLabel : undefined"
          @action="openAllPendingMatches"
        />

        <HomeMatchList
          v-if="shouldShowMatchSection && teamMatches.length"
          variant="brutalist"
          :matches="teamMatches"
          :is-guest-mode="isGuestMode"
          :navigating-match-id="navigatingMatchId"
          :format-match-date-block="formatMatchDateBlock"
          :progress-base-width="progressBaseWidth"
          :progress-extra-width="progressExtraWidth"
          :progress-split-left="progressSplitLeft"
          :stage-class="stageClass"
          :status-class="statusClass"
          @match-tap="handleMatchTap"
        />
        <view v-else-if="shouldShowMatchSection" class="home-empty">
          {{ matchEmptyText }}
        </view>

        <NeoSectionHeader
          title="约队机会"
          :caption="opportunityCaption"
          action-label="进入大厅"
          @action="openTab('/pages/activities/index')"
        />

        <HomeOpportunityList
          v-if="challengeCards.length"
          :cards="challengeCards"
          :challenge-stage-class="challengeStageClass"
          :submitting="submitting"
          @open-challenge="openChallengeDetail"
          @primary-action="handleOpportunityPrimaryAction"
        />
        <view v-else class="home-empty">当前还没有可关注的约队机会。你可以去大厅发布一条，或等待其他球队发起。</view>

      </view>
    </view>

    <BottomTabBar current="home" />
  </view>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  padding: 0 28rpx 164rpx;
  background: var(--neo-color-page);
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
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-text);
  color: var(--neo-color-text-inverse);
  font-size: 22rpx;
  font-weight: 700;
  box-shadow: 4rpx 4rpx 0 var(--neo-color-accent);
}

.home-empty {
  margin-top: 24rpx;
  padding: 28rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text-muted);
  font-size: 28rpx;
  line-height: 1.6;
}

/* #ifdef H5 */
.home-page {
  width: 100%;
  max-width: 750rpx;
  margin: 0 auto;
}

.home-page :deep(.app-tab-header-shell),
.home-page :deep(.custom-tabbar) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */
</style>
