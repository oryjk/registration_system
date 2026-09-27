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
import AvatarPreviewDialog from "@/components/ui/AvatarPreviewDialog.vue";
import type { AvatarItem } from "@/components/ui/avatarTypes";
import HomeSectionHeader from "./components/HomeSectionHeader.vue";
import HomeEmptyHero from "./components/HomeEmptyHero.vue";
import HomeVenueMapEntry from "./components/HomeVenueMapEntry.vue";
import HomeActionMatchCarousel from "./components/HomeActionMatchCarousel.vue";
import { useHomeActionDeckDetails } from "./useHomeActionDeckDetails";
import HomeMatchList from "./components/HomeMatchList.vue";
import HomeTeamSwitcher from "./components/HomeTeamSwitcher.vue";
import RunningLoader from "@/components/ui/RunningLoader.vue";
import { getMatchHome } from "@/api/match";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { useMiniReviewStatus } from "@/stores/miniReview";
import { useTeamContext } from "@/stores/teamContext";
import type { AppMatchUiPhase } from "@/types/match";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { hasManualLogout } from "@/utils/authStorage";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useShareCover } from "@/composables/useShareCover";

import {
  buildHomeMatchSections,
  type HomeMatchSectionViewModel,
} from "./homeMatchState";
import { useHomeOnboardingGuide } from "./useHomeOnboardingGuide";
import { resolveHomeEmptyHeroState, type HomeEmptyHeroAction } from "./homeEmptyHeroState";
import { useOnboardingNavigation } from "@/composables/useOnboardingNavigation";
import { createHomeRuntimeConfigCycle } from "./homeRuntimeConfigCycle";
import { useOnboardingIllustrations } from "@/composables/useOnboardingIllustrations";
import { useHomeNextMatchSocialImage } from "./useHomeNextMatchSocialImage";

const { shareCoverUrl, refreshShareCover } = useShareCover("home");
onShow(() => { void refreshShareCover(); });

const { themePageStyle } = useAccentTheme();
const previewAvatar = ref<AvatarItem | null>(null);
const avatarPreviewVisible = ref(false);
const avatarPreviewRendered = ref(false);
function openAvatarPreview(avatar: AvatarItem) {
  previewAvatar.value = { ...avatar };
  avatarPreviewVisible.value = true;
}

const { ensureSessionReady, currentUser, teamProfiles, currentTeam, switchTeam } = useTeamContext();
const { syncUnreadCount } = useNotificationCenter();
const { shouldHideCreationEntrances } = useMiniReviewStatus();
// 首页 runtime config 按加载周期缓存插画请求；
// 每轮 loadPageData reset 开启新周期，下拉刷新/隔时回访可拿到换图后的新配置，失败也可重试。
const homeRuntimeConfig = createHomeRuntimeConfigCycle();
const onboardingGuide = useHomeOnboardingGuide();
const guidanceNavigation = useOnboardingNavigation();
const { illustrations, illustrationRevision, refreshIllustrations } = useOnboardingIllustrations(homeRuntimeConfig.load);
const { nextMatchSocialImageUrl, ensureSocialImageLoaded } = useHomeNextMatchSocialImage({
  loadRuntimeConfig: homeRuntimeConfig.load,
});

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
let homeLoadVersion = 0;

type MatchSectionPhase = Exclude<AppMatchUiPhase, "excluded">;

const navMetrics = getCustomNavMetrics();
const contentStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));
const showInitialLoadingState = computed(() => isLoading.value && !hasLoadedOnce.value);
const showHomeLoadError = computed(() => !hasLoadedMatchData.value && !!errorMessage.value);
const emptyHeroState = computed(() => resolveHomeEmptyHeroState({
  isGuest: isGuestMode.value,
  hasTeam: teamProfiles.value.length > 0,
  canManageTeam: !!currentTeam.value?.canManageTeam,
  creationAllowed: !shouldHideCreationEntrances.value,
  intent: onboardingGuide.intent.value,
  memberCount: currentTeam.value?.memberCount,
}));
// L1「球队即标题」：登录且有球队时标题位显示球队身份；≥2 支可下拉切换，单队纯展示。
const showTeamSwitcher = computed(() => !isGuestMode.value && teamProfiles.value.length >= 1);
// D 风格主次层级：待处理叠卡只承载 upcoming；进行中/已结束留在各自的查看型分区，
// 没有待处理时进行中比赛仍显示在「进行中的比赛」区域，不顶替成大卡。
const actionDeckMatches = computed(() => upcomingMatches.value);
const actionDeckIndex = ref(0);
watch(actionDeckMatches, (matches, previous) => {
  const previousId = previous?.[actionDeckIndex.value]?.id;
  const next = matches.findIndex((match) => match.id === previousId);
  actionDeckIndex.value = next >= 0 ? next : 0;
});
const heroNextMatch = computed(() => actionDeckMatches.value[actionDeckIndex.value] ?? null);
const deckDetails = useHomeActionDeckDetails(actionDeckMatches, actionDeckIndex);
const actionMatchCardTimestamp = ref(Date.now());
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

function openBrowseMatches() {
  // 普通浏览不记录身份；只在用户明确选择任务时保存偏好。
  openTab("/pages/activities/index");
}

async function openCreateTeam() {
  if (shouldHideCreationEntrances.value) return false;
  return guidanceNavigation.navigateTo("/pages/teams/create/index?from=onboarding");
}

function openJoinTeam() {
  return guidanceNavigation.navigateTo("/pages/teams/join/index");
}

function openTeamDetail() {
  if (!currentTeam.value) return;
  void guidanceNavigation.navigateTo(`/pages/teams/detail/index?teamId=${currentTeam.value.id}`);
}

function openHelp() {
  uni.navigateTo({ url: "/pages/user/help/index" });
}

function openCreatePickup() {
  if (shouldHideCreationEntrances.value) return;
  void guidanceNavigation.navigateTo("/pages/challenges/create-individual/index");
}

function openCreateMatch() {
  if (shouldHideCreationEntrances.value || !currentTeam.value?.canManageTeam) return;
  void guidanceNavigation.navigateTo("/pages/matches/create/index");
}

async function handleTaskChoice(action: HomeEmptyHeroAction) {
  if (guidanceNavigation.busy.value) return;
  if (action === "browse") {
    if (!teamProfiles.value.length) onboardingGuide.setIntent("player");
    openBrowseMatches();
  } else if (action === "create-team" || action === "join-team") {
    const opened = await (action === "create-team" ? openCreateTeam() : openJoinTeam());
    if (opened && !teamProfiles.value.length) {
      onboardingGuide.setIntent(action === "create-team" ? "captain" : "member");
    }
  }
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
  actionMatchCardTimestamp.value = Date.now();
  const loadVersion = ++homeLoadVersion;
  const preserveContent = !!options?.preserveContent && hasLoadedOnce.value;
  // 每轮首页加载开启新的 runtime config 周期并触发插画加载（增强体验，静默失败，
  // 不 await：不阻塞比赛数据主链路）。
  homeRuntimeConfig.reset();
  ensureSocialImageLoaded();
  void refreshIllustrations();

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
    if (!currentUser.value) {
      isGuestMode.value = true;
      clearMatchSections();
      hasLoadedMatchData.value = true;
      hasLoadedOnce.value = true;
      return;
    }
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
  imageUrl: shareCoverUrl.value,
}));

onShareTimeline(() => ({
  title: shareTitle,
  query: "",
  imageUrl: shareCoverUrl.value,
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
          <view class="home-title-team">
            <HomeTeamSwitcher
              v-if="showTeamSwitcher"
              :teams="teamProfiles"
              :current-team-id="currentTeam?.id"
              @switch-team="switchTeam"
            />
            <text v-else class="home-header-title">首页</text>
          </view>

        </view>
      </template>
    </AppTabHeader>

    <AppPullScrollView ref="appScrollAnchor" :refreshing="refreshing" :locked="avatarPreviewRendered" @refresh="handleRefresherRefresh">
      <view class="home-content" :style="contentStyle">
      <RunningLoader v-if="showInitialLoadingState" />

      <view v-else>
        <view v-if="isRefreshing && !refreshing" class="home-refresh-mask">
          <view class="home-refresh-chip">更新中...</view>
        </view>

        <HomeActionMatchCarousel
          v-if="heroNextMatch"
          :matches="actionDeckMatches"
          :index="actionDeckIndex"
          :details="deckDetails.entries.value"
          :navigating-match-id="navigatingMatchId"
          :now="actionMatchCardTimestamp"
          @change="actionDeckIndex = $event"
          @match-tap="handleMatchTap"
          @retry="deckDetails.reload"
          @avatar-select="openAvatarPreview"
        />
        <HomeEmptyHero
          v-else-if="hasLoadedMatchData && !ongoingMatches.length"
          :state="emptyHeroState"
          :collapsed="onboardingGuide.collapsed.value"
          :busy="guidanceNavigation.busy.value"
          :social-image-url="nextMatchSocialImageUrl"
          :onboarding-images="illustrations"
          :image-revision="illustrationRevision"
          @browse="openBrowseMatches"
          @create-team="openCreateTeam"
          @create-match="openCreateMatch"
          @create-pickup="openCreatePickup"
          @join-team="openJoinTeam"
          @invite-team="openTeamDetail"
          @view-team="openTeamDetail"
          @select-task="handleTaskChoice"
          @reset-intent="onboardingGuide.resetIntent"
          @collapse="onboardingGuide.collapse"
          @expand="onboardingGuide.expand"
          @help="openHelp"
        />

        <HomeVenueMapEntry />

        <view v-if="showHomeLoadError" class="home-empty home-empty-compact">
          <view>{{ errorMessage }}</view>
          <view class="home-empty-action" @tap="handleRetryLoad">点击重试</view>
        </view>

        <template v-else>
          <!-- 待处理比赛统一由上方行动卡展示；下方列表仅保留进行中与已结束的查看入口。 -->
          <HomeSectionHeader v-if="!isGuestMode && additionalOngoingMatches.length" title="进行中的比赛" :action-label="ongoingMatches.length ? '更多' : undefined" @action='openMatchList("ongoing")' />
          <HomeMatchList
            v-if="!isGuestMode && additionalOngoingMatches.length"
            :matches="additionalOngoingMatches"
            :navigating-match-id="navigatingMatchId"
            @match-tap="handleMatchTap"
          />
          <HomeSectionHeader v-if="!isGuestMode && endedMatches.length" title="已结束的比赛" action-label="更多" @action='openMatchList("ended")' />
          <HomeMatchList
            v-if="!isGuestMode && endedMatches.length"
            :matches="endedMatches"
            :navigating-match-id="navigatingMatchId"
            @match-tap="handleMatchTap"
          />
        </template>
      </view>
    </view>
    </AppPullScrollView>

    <BottomTabBar current="home" />

    <AvatarPreviewDialog :visible="avatarPreviewVisible" :avatar="previewAvatar" @close="avatarPreviewVisible = false" @presence="avatarPreviewRendered = $event" />
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
  padding-bottom: var(--ui-tabbar-clearance);
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

/* 标题行只展示球队身份。 */
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

/* #ifdef H5 */
.home-page {
  width: 100%;
  max-width: 750rpx;
  margin: 0 auto;
}

.home-page :deep(.app-tab-header-shell) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */
</style>
