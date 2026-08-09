<script setup lang="ts">
import { computed, ref } from "vue";
import { onHide, onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import { NeoSectionHeader } from "@/components/neo";
import HomeHeroSection from "./components/HomeHeroSection.vue";
import HomeMatchList from "./components/HomeMatchList.vue";
import HomeSkeleton from "./components/HomeSkeleton.vue";
import { getMatchHome } from "@/api/match";
import { defaultMiniAppRuntimeConfig } from "@/config/runtimeConfig";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { useTeamContext } from "@/stores/teamContext";
import type { AppMatchUiPhase } from "@/types/match";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { getAccessToken, hasManualLogout } from "@/utils/authStorage";
import { getCustomNavMetrics } from "@/utils/customNav";
import { DEFAULT_SHARE_IMAGE_URL } from "@/utils/share";
import { attendanceStatusTone } from "@/utils/statusTone";
import { buildHomeMatchSections } from "./homeMatchState";
import { formatHomeMatchDateBlock } from "./homeMatchDate";

const { ensureSessionReady } = useTeamContext();
const { syncUnreadCount } = useNotificationCenter();

const isLoading = ref(false);
const isRefreshing = ref(false);
const hasLoadedOnce = ref(false);
const hasLoadedMatchData = ref(false);
const errorMessage = ref("");
const isGuestMode = ref(false);
const navigatingMatchId = ref("");
const hiddenAt = ref<number | null>(null);
const pendingReloadFromEvent = ref(false);
const HIDDEN_RELOAD_THRESHOLD_MS = 2 * 60 * 1000;
const upcomingMatches = ref<HomeMatchCardViewModel[]>([]);
const ongoingMatches = ref<HomeMatchCardViewModel[]>([]);
const endedMatches = ref<HomeMatchCardViewModel[]>([]);
const homeHeroBanners = ref(defaultMiniAppRuntimeConfig.home.hero_banners);
let homeLoadVersion = 0;

type MatchSectionPhase = Exclude<AppMatchUiPhase, "excluded">;

const navMetrics = getCustomNavMetrics();
const pageStyle = computed(() => ({
  padding: "0 28rpx 180rpx",
}));
const contentStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));
const showInitialLoadingState = computed(() => isLoading.value && !hasLoadedOnce.value);
const showHomeLoadError = computed(() => !hasLoadedMatchData.value && !!errorMessage.value);
const upcomingEmptyText = computed(() => (
  isGuestMode.value
    ? "登录后可以查看最近要处理的比赛"
    : "当前没有最近要处理的比赛，稍后再回来看看。"
));
const shareTitle = "约球开踢：组队、报名、上场";
const sharePath = "/pages/home/index";

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
  switch (stage) {
    case "进行中":
      return "home-stage home-stage-blue";
    case "已结束":
      return "home-stage home-stage-muted";
    default:
      return "home-stage";
  }
}

function clearMatchSections() {
  upcomingMatches.value = [];
  ongoingMatches.value = [];
  endedMatches.value = [];
}

function applyMatchSection(phase: MatchSectionPhase, matches: HomeMatchCardViewModel[]) {
  switch (phase) {
    case "upcoming":
      upcomingMatches.value = matches;
      return;
    case "ongoing":
      ongoingMatches.value = matches;
      return;
    case "ended":
      endedMatches.value = matches;
      return;
  }
}

function openTab(path: string) {
  uni.switchTab({ url: path });
}

function openMatchList(phase: MatchSectionPhase) {
  uni.navigateTo({ url: `/pages/home/matches/index?phase=${phase}` });
}

function handleMatchTap(match: HomeMatchCardViewModel) {
  if (!match.canOpenDetail || navigatingMatchId.value) return;

  navigatingMatchId.value = match.id;
  uni.navigateTo({
    url: match.detailUrl,
    fail: () => {
      navigatingMatchId.value = "";
    },
  });
}

function handleRetryLoad() {
  void loadPageData();
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
      if (loadVersion !== homeLoadVersion) return;
      isGuestMode.value = true;
      clearMatchSections();
      hasLoadedMatchData.value = true;
      hasLoadedOnce.value = true;
      return;
    }

    isGuestMode.value = false;
    await ensureSessionReady();
    if (loadVersion !== homeLoadVersion) return;
    const response = await getMatchHome();
    if (loadVersion !== homeLoadVersion) return;
    const sections = buildHomeMatchSections(response, new Date(), 2);
    if (loadVersion !== homeLoadVersion) return;

    clearMatchSections();
    for (const section of sections) {
      applyMatchSection(section.phase, section.items);
    }

    errorMessage.value = "";
    hasLoadedMatchData.value = true;
    hasLoadedOnce.value = true;
    void syncUnreadCount({ skipEnsure: true }).catch(() => {
      // Notification count is nice-to-have for the home screen.
    });
  } catch (error) {
    if (loadVersion !== homeLoadVersion) return;
    errorMessage.value = error instanceof Error ? error.message : "首页数据加载失败";
    if (!preserveContent) {
      hasLoadedMatchData.value = false;
    }
    uni.showToast({
      title: errorMessage.value,
      icon: "none",
    });
  } finally {
    if (loadVersion !== homeLoadVersion) return;
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

        <view v-if="showHomeLoadError" class="home-empty home-empty-compact">
          <view>{{ errorMessage }}</view>
          <view class="home-empty-action" @tap="handleRetryLoad">点击重试</view>
        </view>

        <template v-else>
          <NeoSectionHeader title="最近要处理的比赛" marker="热" :action-label="upcomingMatches.length ? '更多' : undefined" @action='openMatchList("upcoming")' />
          <HomeMatchList
            v-if="upcomingMatches.length"
            variant="brutalist"
            :matches="upcomingMatches"
            :is-guest-mode="isGuestMode"
            :navigating-match-id="navigatingMatchId"
            :format-match-date-block="formatHomeMatchDateBlock"
            :progress-base-width="progressBaseWidth"
            :progress-extra-width="progressExtraWidth"
            :progress-split-left="progressSplitLeft"
            :stage-class="stageClass"
            :status-class="statusClass"
            @match-tap="handleMatchTap"
          />
          <view v-else class="home-empty home-empty-compact">{{ upcomingEmptyText }}</view>

          <NeoSectionHeader v-if="!isGuestMode" title="进行中的比赛" marker="赛" :action-label="ongoingMatches.length ? '更多' : undefined" @action='openMatchList("ongoing")' />
          <HomeMatchList
            v-if="!isGuestMode && ongoingMatches.length"
            variant="brutalist"
            :matches="ongoingMatches"
            :is-guest-mode="isGuestMode"
            :navigating-match-id="navigatingMatchId"
            :format-match-date-block="formatHomeMatchDateBlock"
            :progress-base-width="progressBaseWidth"
            :progress-extra-width="progressExtraWidth"
            :progress-split-left="progressSplitLeft"
            :stage-class="stageClass"
            :status-class="statusClass"
            @match-tap="handleMatchTap"
          />
          <view v-else-if="!isGuestMode" class="home-empty home-empty-compact">当前没有进行中的比赛。</view>

          <NeoSectionHeader v-if="!isGuestMode" title="已结束的比赛" marker="终" :action-label="endedMatches.length ? '更多' : undefined" @action='openMatchList("ended")' />
          <HomeMatchList
            v-if="!isGuestMode && endedMatches.length"
            variant="brutalist"
            :matches="endedMatches"
            :is-guest-mode="isGuestMode"
            :navigating-match-id="navigatingMatchId"
            :format-match-date-block="formatHomeMatchDateBlock"
            :progress-base-width="progressBaseWidth"
            :progress-extra-width="progressExtraWidth"
            :progress-split-left="progressSplitLeft"
            :stage-class="stageClass"
            :status-class="statusClass"
            @match-tap="handleMatchTap"
          />
          <view v-else-if="!isGuestMode" class="home-empty home-empty-compact">当前没有已结束的比赛。</view>
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

.home-empty-compact {
  margin-bottom: 12rpx;
  padding: 22rpx 24rpx;
  font-size: 26rpx;
}

.home-empty-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 16rpx;
  padding: 10rpx 18rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 700;
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
