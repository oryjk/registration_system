<script setup lang="ts">
import { computed, provide, ref, watch } from "vue";
import { useAccentTheme } from "@/stores/theme";
import { usePullRefresh } from "@/composables/usePullRefresh";
import { APP_SCROLL_CONTROLLER, createAppScrollAnchor } from "@/components/appScroll";
import { onHide, onLoad, onShareAppMessage, onShareTimeline, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppPullScrollView from "@/components/AppPullScrollView.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import { tabBarMotion } from "@/components/tabBarMotion";
import ProfileCompletionDialog from "@/components/ProfileCompletionDialog.vue";
import AvatarPreviewDialog from "@/components/ui/AvatarPreviewDialog.vue";
import type { AvatarItem } from "@/components/ui/avatarTypes";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import HomeSectionHeader from "./components/HomeSectionHeader.vue";
import HomeHeroSection from "./components/HomeHeroSection.vue";
import HomeActionMatchDeck from "./components/HomeActionMatchDeck.vue";
import HomeActionMatchCard from "./components/HomeActionMatchCard.vue";
import { useHomeActionDeckDetails } from "./useHomeActionDeckDetails";
import HomeMatchList from "./components/HomeMatchList.vue";
import HomeMatchSearchResults from "./components/HomeMatchSearchResults.vue";
import HomeHeaderSearch from "./components/HomeHeaderSearch.vue";
import HomeTeamSwitcher from "./components/HomeTeamSwitcher.vue";
import RunningLoader from "@/components/ui/RunningLoader.vue";
import OnboardingRolePickerDialog from "./components/OnboardingRolePickerDialog.vue";
import { getMatchHome, listMyMatches } from "@/api/match";
import { defaultMiniAppRuntimeConfig } from "@/config/runtimeConfig";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { useTeamContext } from "@/stores/teamContext";
import type { AppMatchSummary, AppMatchUiPhase } from "@/types/match";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { hasManualLogout } from "@/utils/authStorage";
import { getCustomNavMetrics } from "@/utils/customNav";
import { HOME_SHARE_IMAGE_URL } from "@/utils/share";
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
import { useHomeOnboardingGuide } from "./useHomeOnboardingGuide";

const { themePageStyle } = useAccentTheme();
const previewAvatar = ref<AvatarItem | null>(null);
const avatarPreviewVisible = ref(false);
const avatarPreviewRendered = ref(false);
function openAvatarPreview(avatar: AvatarItem) {
  previewAvatar.value = { ...avatar };
  avatarPreviewVisible.value = true;
}

const { ensureSessionReady, teamProfiles, currentTeam, switchTeam } = useTeamContext();
const { syncUnreadCount } = useNotificationCenter();
const onboardingGuide = useHomeOnboardingGuide();

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
// header 搜索展开态：展开时标题行的球队切换器让位给搜索框。
const headerSearchActive = ref(false);
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
// L1「球队即标题」：登录且有球队时标题位显示球队身份；≥2 支可下拉切换，单队纯展示。
const showTeamSwitcher = computed(() => !isGuestMode.value && teamProfiles.value.length >= 1);
// D 风格主次层级：待处理叠卡只承载 upcoming；进行中/已结束留在各自的查看型分区，
// 没有待处理时进行中比赛仍显示在「进行中的比赛」区域，不顶替成大卡。
const actionDeckMatches = computed(() => upcomingMatches.value);
const actionDeckIndex = ref(0);
const deckInteracting = ref(false);
watch(actionDeckMatches, (matches, previous) => {
  const previousId = previous?.[actionDeckIndex.value]?.id;
  const next = matches.findIndex((match) => match.id === previousId);
  actionDeckIndex.value = next >= 0 ? next : 0;
});
const heroNextMatch = computed(() => actionDeckMatches.value[actionDeckIndex.value] ?? null);
const deckDetails = useHomeActionDeckDetails(actionDeckMatches, actionDeckIndex);
const actionMatchCard = deckDetails.active;
const nextMatchCard = computed(() => actionDeckMatches.value[actionDeckIndex.value + 1] ?? null);
const previousMatchCard = computed(() => actionDeckMatches.value[actionDeckIndex.value - 1] ?? null);
const actionMatchCardTimestamp = ref(Date.now());
const additionalUpcomingMatches = computed(() => upcomingMatches.value.filter((match) => !actionDeckMatches.value.some((item) => item.id === match.id)));
const additionalOngoingMatches = computed(() => ongoingMatches.value.filter((match) => !actionDeckMatches.value.some((item) => item.id === match.id)));
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
      endedMatches.value = section.items.slice(0, 3);
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
    // 广场入口已下线（发现场景归约队页），首页搜索只搜自己的比赛。
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
  actionMatchCardTimestamp.value = Date.now();
  const loadVersion = ++homeLoadVersion;
  const preserveContent = !!options?.preserveContent && hasLoadedOnce.value;
  const isFirstLoad = !hasLoadedOnce.value;

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
    const sections = buildHomeMatchSections(response, new Date());
    if (loadVersion !== homeLoadVersion) return;

    clearMatchSections();
    for (const section of sections) {
      applyMatchSection(section);
    }

    errorMessage.value = "";
    hasLoadedMatchData.value = true;
    hasLoadedOnce.value = true;
    if (isFirstLoad) {
      onboardingGuide.maybeStartAfterFirstLoad();
    }
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
  // 游客先进首页、之后才登录的场景：登录完成后同样给一次新手引导机会。
  onboardingGuide.maybeStartAfterFirstLoad();
}

function handleHomeDataMayChanged() {
  pendingReloadFromEvent.value = true;
}

onShow(() => {
  tabBarMotion.show("home");
  actionMatchCardTimestamp.value = Date.now();
  // H5 路由切换时 onShow 可能早于 TabBar 挂载，此时无需隐藏。
  uni.hideTabBar({ animation: false, fail: () => {} });

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
  avatarPreviewVisible.value = false;
  hiddenAt.value = Date.now();
  if (navigatingMatchId.value) {
    navigatingMatchId.value = "";
  }
});

// scroll-view 自定义下拉：页面本体不滚动，固定 header 不随下拉拖动。
const { refreshing, handleRefresherRefresh } = usePullRefresh(() => loadPageData({ preserveContent: hasLoadedOnce.value }));
// 滚动锚点提升到页面根：AppTabHeader 与滚动容器是兄弟节点，provide 必须来自页面。
const { anchor: appScrollAnchor, controller: appScrollController } = createAppScrollAnchor();
provide(APP_SCROLL_CONTROLLER, appScrollController);

onLoad(() => {
  uni.$on("session:login-completed", handleSessionLoginCompleted);
  uni.$on("home:data-may-changed", handleHomeDataMayChanged);
});

onUnload(() => {
  uni.$off("session:login-completed", handleSessionLoginCompleted);
  uni.$off("home:data-may-changed", handleHomeDataMayChanged);
  onboardingGuide.dispose();
});

onShareAppMessage(() => ({
  title: shareTitle,
  path: sharePath,
  imageUrl: HOME_SHARE_IMAGE_URL,
}));

onShareTimeline(() => ({
  title: shareTitle,
  query: "",
  imageUrl: HOME_SHARE_IMAGE_URL,
}));
</script>

<template>
  <!-- 页面本体锁定不滚动（滚动在 AppPullScrollView 内），原生下拉不再触发，header 不随下拉移动。 -->
  <page-meta :page-style="`${themePageStyle};overflow:hidden`" />
  <view class="app-theme-scope home-page" :style="themePageStyle">
    <AppTabHeader title="首页">
      <!-- mp 端 slot 内容不吃子组件 scoped 样式，回落标题用页面自己的类保持同款字号。 -->
      <template #title>
        <view class="home-title-row">
          <!-- 球队名容器允许被搜索框从右往左挤掉（宽度随兄弟节点过渡收缩并裁切）。 -->
          <view class="home-title-team">
            <HomeTeamSwitcher
              v-if="showTeamSwitcher"
              :teams="teamProfiles"
              :current-team-id="currentTeam?.id"
              :force-closed="headerSearchActive"
              @switch-team="switchTeam"
            />
            <text v-else class="home-header-title">首页</text>
          </view>
          <!-- 搜索入口与球队同在标题行：收起时只是右端放大镜图标，点击后宽度动画展开为整行搜索框。 -->
          <view :class="['home-title-search', headerSearchActive ? 'home-title-search--active' : '']">
            <HomeHeaderSearch
              :active="headerSearchActive"
              :query="searchQuery"
              @update:active="headerSearchActive = $event"
              @update:query="searchQuery = $event"
              @search="handleSearch"
              @clear="clearSearchResults"
            />
          </view>
        </view>
      </template>
    </AppTabHeader>

    <AppPullScrollView ref="appScrollAnchor" :refreshing="refreshing" :locked="avatarPreviewRendered" @refresh="handleRefresherRefresh" @reach-bottom="loadMoreSearchResults">
      <view class="home-content" :style="contentStyle">
      <RunningLoader v-if="showInitialLoadingState" />

      <view v-else>
        <view v-if="isRefreshing && !refreshing" class="home-refresh-mask">
          <view class="home-refresh-chip">更新中...</view>
        </view>

        <HomeActionMatchDeck v-if="heroNextMatch" :index="actionDeckIndex" :count="actionDeckMatches.length" @change="actionDeckIndex = $event" @interaction="deckInteracting = $event">
        <HomeActionMatchCard
          :deck-count="actionDeckMatches.length"
          :deck-index="actionDeckIndex"
          :interaction-blocked="deckInteracting"
          :match="heroNextMatch"
          :detail="actionMatchCard.detail"
          :loading="actionMatchCard.loading"
          :error="actionMatchCard.error"
          :navigating="navigatingMatchId === heroNextMatch.id"
          :now="actionMatchCardTimestamp"
          @match-tap="handleMatchTap"
          @retry="deckDetails.reload"
          @avatar-select="openAvatarPreview"
        />
        <template #next>
          <HomeActionMatchCard v-if="nextMatchCard" :match="nextMatchCard" :detail="deckDetails.next.value.detail" :loading="deckDetails.next.value.loading" :error="deckDetails.next.value.error" :navigating="false" :now="actionMatchCardTimestamp" :deck-count="actionDeckMatches.length" :deck-index="actionDeckIndex + 1" preview />
        </template>
        <template #previous>
          <HomeActionMatchCard v-if="previousMatchCard" :match="previousMatchCard" :detail="deckDetails.previous.value.detail" :loading="deckDetails.previous.value.loading" :error="deckDetails.previous.value.error" :navigating="false" :now="actionMatchCardTimestamp" :deck-count="actionDeckMatches.length" :deck-index="actionDeckIndex - 1" preview />
        </template>
        </HomeActionMatchDeck>
        <HomeHeroSection
          v-else
          :hero-banners="homeHeroBanners"
          :next-match="heroNextMatch"
          @banner-tap="openTab('/pages/activities/index')"
          @match-tap="handleMatchTap"
        />

        <HomeMatchSearchResults
          :has-searched="hasSearched"
          :is-loading="isSearching"
          :is-guest-mode="isGuestMode"
          :navigating-match-id="navigatingMatchId"
          :matches="searchMatches"
          :error-message="searchErrorMessage"
          :has-more="searchHasMore"
          :total="searchTotal"
          @retry="retrySearchPage"
          @load-more="loadMoreSearchResults"
          @match-tap="handleMatchTap"
        />

        <view v-if="!hasSearched && showHomeLoadError" class="home-empty home-empty-compact">
          <view>{{ errorMessage }}</view>
          <view class="home-empty-action" @tap="handleRetryLoad">点击重试</view>
        </view>

        <template v-else-if="!hasSearched">
          <!-- 最近要处理的比赛卡已展示待处理集合，列表只放未包含的比赛；完整列表入口保留。 -->
          <HomeSectionHeader v-if="additionalUpcomingMatches.length || !heroNextMatch" title="最近要处理的比赛" :action-label="upcomingMatches.length ? '更多' : undefined" @action='openMatchList("upcoming")' />
          <HomeMatchList
            v-if="additionalUpcomingMatches.length"
            :matches="additionalUpcomingMatches"
            :is-guest-mode="isGuestMode"
            :navigating-match-id="navigatingMatchId"
            @match-tap="handleMatchTap"
          />
          <view v-else-if="!heroNextMatch" class="home-empty home-empty-compact">
            <text>{{ upcomingEmptyText }}</text>
            <view v-if="!isGuestMode" class="home-empty-link" hover-class="home-empty-link--pressed" :hover-stay-time="100" @tap="openTab('/pages/activities/index')">去约队大厅看看 ›</view>
          </view>

          <HomeSectionHeader v-if="!isGuestMode && additionalOngoingMatches.length" title="进行中的比赛" :action-label="ongoingMatches.length ? '更多' : undefined" @action='openMatchList("ongoing")' />
          <HomeMatchList
            v-if="!isGuestMode && additionalOngoingMatches.length"
            :matches="additionalOngoingMatches"
            :is-guest-mode="isGuestMode"
            :navigating-match-id="navigatingMatchId"
            @match-tap="handleMatchTap"
          />
          <view v-else-if="!isGuestMode && !ongoingMatches.length" class="home-empty home-empty-compact">当前没有进行中的比赛。</view>

          <HomeSectionHeader v-if="!isGuestMode" title="已结束的比赛" :action-label="endedMatches.length ? '更多' : undefined" @action='openMatchList("ended")' />
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
    </AppPullScrollView>

    <BottomTabBar current="home" />

    <!-- 新手引导：身份选择 → 完善资料 →（队长）去创建球队 -->
    <AvatarPreviewDialog :visible="avatarPreviewVisible" :avatar="previewAvatar" @close="avatarPreviewVisible = false" @presence="avatarPreviewRendered = $event" />
    <OnboardingRolePickerDialog
      :visible="onboardingGuide.rolePickerVisible.value"
      @select-captain="onboardingGuide.handleSelectCaptain"
      @select-player="onboardingGuide.handleSelectPlayer"
      @skip="onboardingGuide.handleSkip"
    />
    <ProfileCompletionDialog
      :visible="onboardingGuide.profileDialogVisible.value"
      primary-text="保存并继续"
      @completed="onboardingGuide.handleProfileCompleted"
      @cancel="onboardingGuide.handleProfileCancel"
    />
    <ConfirmDialog
      :visible="onboardingGuide.createTeamPromptVisible.value"
      title="资料已就绪"
      message="接下来创建你的球队，创建后可以把球队分享给队员，邀请他们加入。"
      primary-text="去创建球队"
      secondary-text="稍后再说"
      @primary="onboardingGuide.handleCreateTeamConfirmed"
      @secondary="onboardingGuide.handleCreateTeamDeclined"
      @close="onboardingGuide.handleCreateTeamDeclined"
    />
  </view>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  padding: 0 28rpx;
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.home-content {
  position: relative;
  /* 滚动收进 AppPullScrollView 后，底栏留白由滚动内容自己承担。 */
  padding-bottom: 180rpx;
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
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-text);
  color: var(--ui-color-text-inverse);
  font-size: 22rpx;
  font-weight: 500;
}

.home-header-title {
  color: var(--ui-color-text);
  font-size: 34rpx;
  font-weight: 600;
}

/* 标题行：球队区在左（可被挤掉）、搜索入口在右；展开动画靠搜索宿主宽度过渡驱动。 */
.home-title-row {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.home-title-team {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

/* 收起宽 76rpx = 64rpx 图标 + 12rpx 与球队名的间距；展开过渡到整行，球队名随之被挤出视野。 */
.home-title-search {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
  flex-shrink: 0;
  width: 76rpx;
  transition: width 240ms cubic-bezier(0.33, 0, 0.2, 1);
}

.home-title-search--active {
  width: 100%;
}

.home-empty {
  margin-top: 24rpx;
  padding: 28rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text-muted);
  font-size: 26rpx;
  line-height: 1.6;
}

.home-empty-compact {
  margin-bottom: 12rpx;
  padding: 22rpx 24rpx;
  font-size: 24rpx;
}

.home-empty-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 16rpx;
  padding: 10rpx 18rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  font-size: 24rpx;
  font-weight: 500;
}

/* 待处理空态的轻量浏览入口：链接语义，不做大按钮。 */
.home-empty-link {
  display: inline-flex;
  align-items: center;
  margin-top: 12rpx;
  color: var(--ui-color-accent-deep);
  font-size: 24rpx;
  font-weight: 500;
}

.home-empty-link--pressed {
  opacity: 0.72;
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
