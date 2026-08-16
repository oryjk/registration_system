<script setup lang="ts">
import { computed, ref } from "vue";
import { onHide, onLoad, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import HomeHeroSection from "./components/HomeHeroSection.vue";
import HomeMatchList from "./components/HomeMatchList.vue";
import HomeMatchSearch from "./components/HomeMatchSearch.vue";
import HomeSkeleton from "./components/HomeSkeleton.vue";
import { getMatchHome, listMyMatches } from "@/api/match";
import { defaultMiniAppRuntimeConfig } from "@/config/runtimeConfig";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { useTeamContext } from "@/stores/teamContext";
import type { AppMatchSummary, AppMatchUiPhase } from "@/types/match";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { hasManualLogout } from "@/utils/authStorage";
import { getCustomNavMetrics } from "@/utils/customNav";
import { DEFAULT_SHARE_IMAGE_URL } from "@/utils/share";
import {
  buildHomeMatchSections,
  type HomeMatchSectionViewModel,
} from "./homeMatchState";
import {
  HOME_MATCH_SEARCH_PAGE_SIZE,
  mergeHomeMatchSearchPage,
  resolveHomeMatchSearchLoadMoreIntent,
  toHomeMatchSearchCard,
} from "./homeMatchSearchState";

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
const searchQuery = ref("");
const activeSearchQuery = ref("");
const searchSourceMatches = ref<AppMatchSummary[]>([]);
const searchMatches = computed(() => searchSourceMatches.value.map((match) => toHomeMatchSearchCard(match)));
const searchPage = ref(0);
const searchTotal = ref(0);
const searchHasMore = ref(false);
const isSearching = ref(false);
const hasSearched = ref(false);
const searchErrorMessage = ref("");
let homeLoadVersion = 0;
let searchLoadVersion = 0;
// 正在加载中的搜索结果目标页码；相同目标页的重复意图直接忽略，不做排队重放。
let searchLoadingTargetPage = 0;

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

function clearMatchSections() {
  upcomingMatches.value = [];
  ongoingMatches.value = [];
  endedMatches.value = [];
}

function applyMatchSection(section: HomeMatchSectionViewModel) {
  switch (section.phase) {
    case "upcoming":
      upcomingMatches.value = section.items;
      return;
    case "ongoing":
      ongoingMatches.value = section.items;
      return;
    case "ended":
      endedMatches.value = section.items;
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

function clearSearchResults() {
  searchLoadVersion += 1;
  searchQuery.value = "";
  activeSearchQuery.value = "";
  hasSearched.value = false;
  searchErrorMessage.value = "";
  searchSourceMatches.value = [];
  searchPage.value = 0;
  searchTotal.value = 0;
  searchHasMore.value = false;
  isSearching.value = false;
  searchLoadingTargetPage = 0;
}

async function loadSearchPage(page: number, query: string, loadVersion: number) {
  if (page === searchLoadingTargetPage) return;
  searchLoadingTargetPage = page;
  searchErrorMessage.value = "";
  isSearching.value = true;
  try {
    const response = await listMyMatches({
      page,
      pageSize: HOME_MATCH_SEARCH_PAGE_SIZE,
      search: query,
    });
    if (loadVersion !== searchLoadVersion) return;

    const merged = mergeHomeMatchSearchPage(searchSourceMatches.value, response);
    searchSourceMatches.value = merged.matches;
    searchPage.value = merged.page;
    searchTotal.value = merged.total;
    searchHasMore.value = merged.hasMore;
  } catch (error) {
    if (loadVersion !== searchLoadVersion) return;
    searchErrorMessage.value = error instanceof Error ? error.message : "比赛搜索失败";
  } finally {
    if (loadVersion === searchLoadVersion) {
      isSearching.value = false;
      searchLoadingTargetPage = 0;
    }
  }
}

async function handleSearch() {
  const query = searchQuery.value.trim();
  const loadVersion = ++searchLoadVersion;

  activeSearchQuery.value = query;
  searchSourceMatches.value = [];
  searchPage.value = 0;
  searchTotal.value = 0;
  searchHasMore.value = false;
  searchErrorMessage.value = "";
  isSearching.value = false;
  searchLoadingTargetPage = 0;
  hasSearched.value = !!query;

  if (!query || isGuestMode.value) return;
  await loadSearchPage(1, query, loadVersion);
}

function loadMoreSearchResults() {
  const intent = resolveHomeMatchSearchLoadMoreIntent({
    hasActiveSearch: hasSearched.value && !!activeSearchQuery.value,
    isGuestMode: isGuestMode.value,
    isLoading: isSearching.value,
    hasMore: searchHasMore.value,
  });

  if (intent !== "load") return;

  void loadSearchPage(searchPage.value + 1, activeSearchQuery.value, searchLoadVersion);
}

function retrySearchPage() {
  if (isSearching.value || !activeSearchQuery.value || isGuestMode.value) return;
  void loadSearchPage(searchPage.value + 1, activeSearchQuery.value, searchLoadVersion);
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
    if (hasManualLogout()) {
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
      applyMatchSection(section);
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

onReachBottom(() => {
  loadMoreSearchResults();
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

        <HomeMatchSearch
          :query="searchQuery"
          :is-loading="isSearching"
          :has-searched="hasSearched"
          :is-guest-mode="isGuestMode"
          :navigating-match-id="navigatingMatchId"
          :matches="searchMatches"
          :error-message="searchErrorMessage"
          :has-more="searchHasMore"
          :total="searchTotal"
          @update:query="searchQuery = $event"
          @search="handleSearch"
          @clear="clearSearchResults"
          @retry="retrySearchPage"
          @load-more="loadMoreSearchResults"
          @match-tap="handleMatchTap"
        />

        <view v-if="!hasSearched && showHomeLoadError" class="home-empty home-empty-compact">
          <view>{{ errorMessage }}</view>
          <view class="home-empty-action" @tap="handleRetryLoad">点击重试</view>
        </view>

        <template v-else-if="!hasSearched">
          <NeoSectionHeader title="最近要处理的比赛" marker="热" :action-label="upcomingMatches.length ? '更多' : undefined" @action='openMatchList("upcoming")' />
          <HomeMatchList
            v-if="upcomingMatches.length"
            :matches="upcomingMatches"
            :is-guest-mode="isGuestMode"
            :navigating-match-id="navigatingMatchId"
            @match-tap="handleMatchTap"
          />
          <view v-else class="home-empty home-empty-compact">{{ upcomingEmptyText }}</view>

          <NeoSectionHeader v-if="!isGuestMode" title="进行中的比赛" marker="赛" :action-label="ongoingMatches.length ? '更多' : undefined" @action='openMatchList("ongoing")' />
          <HomeMatchList
            v-if="!isGuestMode && ongoingMatches.length"
            :matches="ongoingMatches"
            :is-guest-mode="isGuestMode"
            :navigating-match-id="navigatingMatchId"
            @match-tap="handleMatchTap"
          />
          <view v-else-if="!isGuestMode" class="home-empty home-empty-compact">当前没有进行中的比赛。</view>

          <NeoSectionHeader v-if="!isGuestMode" title="已结束的比赛" marker="终" :action-label="endedMatches.length ? '更多' : undefined" @action='openMatchList("ended")' />
          <HomeMatchList
            v-if="!isGuestMode && endedMatches.length"
            :matches="endedMatches"
            :is-guest-mode="isGuestMode"
            :navigating-match-id="navigatingMatchId"
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
