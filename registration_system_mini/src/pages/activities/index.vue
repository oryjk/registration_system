<script setup lang="ts">
import { usePullRefresh } from "@/composables/usePullRefresh";
import { APP_SCROLL_CONTROLLER, createAppScrollAnchor } from "@/components/appScroll";
import { useAccentTheme } from "@/stores/theme";
import { onHide, onLoad, onShow, onUnload, onShareAppMessage, onShareTimeline } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppPullScrollView from "@/components/AppPullScrollView.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import { tabBarMotion } from "@/components/tabBarMotion";
import AppButton from "@/components/ui/AppButton.vue";
import SectionHeader from "@/components/ui/SectionHeader.vue";
import RunningLoader from "@/components/ui/RunningLoader.vue";
import HallSearchResults from "./components/HallSearchResults.vue";
import { toHallMatchCard } from "./hallMatchState";
import { useHallMatchSearch } from "./useHallMatchSearch";
import HallSearchField from "./components/HallSearchField.vue";
import HallCalendarStrip from "./components/HallCalendarStrip.vue";
import HallQuickFilters from "./components/HallQuickFilters.vue";
import HallMatchList from "./components/HallMatchList.vue";
import PublishTypeSheet from "./components/PublishTypeSheet.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { useHallPage } from "./useHallPage";
import { getCustomNavMetrics } from "@/utils/customNav";
import { MATCH_CREATION_IDENTITY_HINT } from "@/utils/matchCreationAccess";
import { DEFAULT_SHARE_IMAGE_URL } from "@/utils/share";
import { computed, provide, ref } from "vue";

const { themePageStyle } = useAccentTheme();

const {
  showInitialLoadingState,
  isLoadingMore,
  errorMessage,
  isGuestMode,
  canOpenPublishSheet,
  hasPublishIdentity,
  hallCards,
  hallViewer,
  nowTick,
  hasMore,
  calendarDays,
  activeKind,
  activeSize,
  selectedDateKey,
  loadPageData,
  loadMore,
  selectKind,
  selectSize,
  selectDate,
  handleLogin,
  startWindowTimer,
  stopWindowTimer,
} = useHallPage();
const {
  searchQuery, isSearching, hasSearched, searchMatches, searchHasMore, searchErrorMessage,
  handleSearch, clearSearchResults, loadMoreSearchResults,
} = useHallMatchSearch(isGuestMode);
const searchCards = computed(() => searchMatches.value.map(match =>
  toHallMatchCard(match, hallViewer.value, nowTick.value),
));

const navMetrics = getCustomNavMetrics();
const {
  confirmDialogVisible,
  confirmDialogState,
  confirm: confirmDialog,
  handleConfirmPrimary,
  handleConfirmSecondary,
  handleConfirmClose,
  handleConfirmLink,
} = useConfirmDialog();
const publishTypeSheetVisible = ref(false);
const navigatingMatchId = ref("");
const shareTitle = "约队大厅：看看可报名的散人局";
const sharePath = "/pages/activities/index";
const contentStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

function openMatchDetail(card: { id: string; actionKind: string; detailUrl: string; applyUrl: string }) {
  if (navigatingMatchId.value) return;
  navigatingMatchId.value = card.id;
  uni.navigateTo({
    url: card.actionKind === "accept" ? card.applyUrl : card.detailUrl,
    fail: () => {
      navigatingMatchId.value = "";
    },
  });
}

function openPublishTypeSheet() {
  if (isGuestMode.value) {
    void handleLogin();
    return;
  }
  if (!canOpenPublishSheet.value) {
    uni.showToast({
      title: "审核状态下暂不开放发布",
      icon: "none",
    });
    return;
  }
  publishTypeSheetVisible.value = true;
}

function closePublishTypeSheet() {
  publishTypeSheetVisible.value = false;
}

function handlePublishTeamChallenge() {
  closePublishTypeSheet();
  if (!hasPublishIdentity.value) {
    void confirmDialog(MATCH_CREATION_IDENTITY_HINT);
    return;
  }
  uni.navigateTo({ url: "/pages/matches/create/index" });
}

function handlePublishIndividualChallenge() {
  closePublishTypeSheet();
  // 散人约球：无球队概念的独立发布页（online_pickup，POST /matches）。
  uni.navigateTo({ url: "/pages/challenges/create-individual/index" });
}

function handleSessionLoginCompleted() {
  void loadPageData({ preserveContent: true });
}

onShow(() => {
  tabBarMotion.show("challenge");
  // H5 路由切换时 onShow 可能早于 TabBar 挂载，此时无需隐藏。
  uni.hideTabBar({ animation: false, fail: () => {} });
  startWindowTimer();
  void loadPageData({ preserveContent: true, reuseSession: true });
});

onHide(() => {
  navigatingMatchId.value = "";
  stopWindowTimer();
});

onLoad(() => {
  uni.$on("session:login-completed", handleSessionLoginCompleted);
});

onUnload(() => {
  stopWindowTimer();
  clearSearchResults();
  uni.$off("session:login-completed", handleSessionLoginCompleted);
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
// scroll-view 自定义下拉：页面本体不滚动，固定 header 不随下拉拖动。
const { refreshing, handleRefresherRefresh } = usePullRefresh(() => hasSearched.value ? handleSearch() : loadPageData({ preserveContent: true }));
// 滚动锚点提升到页面根：AppTabHeader 与滚动容器是兄弟节点，provide 必须来自页面。
const { anchor: appScrollAnchor, controller: appScrollController } = createAppScrollAnchor();
provide(APP_SCROLL_CONTROLLER, appScrollController);
</script>

<template>
  <!-- 页面本体锁定不滚动（滚动在 AppPullScrollView 内），header 不随下拉移动。 -->
  <page-meta :page-style="`${themePageStyle};overflow:hidden`" />
  <view class="app-theme-scope hall-page" :style="themePageStyle">
    <AppTabHeader title="约队大厅" />

    <AppPullScrollView ref="appScrollAnchor" :refreshing="refreshing" @refresh="handleRefresherRefresh" @reach-bottom="loadMoreSearchResults">
      <view class="hall-content" :style="contentStyle">
      <RunningLoader v-if="showInitialLoadingState" text="正在奔向球场" />

      <view v-else-if="isGuestMode" class="hall-guest-card">
        <text class="hall-guest-title">登录后查看约队大厅</text>
        <text class="hall-guest-subtitle">浏览球队约队和散人约局，报名凑局一场就出发。</text>
        <AppButton block @click="handleLogin">立即登录</AppButton>
      </view>

      <template v-else>
        <HallSearchField v-model="searchQuery" :loading="isSearching" @search="handleSearch" @clear="clearSearchResults" />
        <template v-if="hasSearched">
          <text class="hall-search-scope">搜索大厅比赛及与我相关的比赛，包含已结束、已取消的比赛</text>
          <HallSearchResults
            :has-searched="hasSearched"
            :is-loading="isSearching"
            :is-guest-mode="isGuestMode"
            :matches="searchCards"
            :error-message="searchErrorMessage"
            :has-more="searchHasMore"
            @retry="loadMoreSearchResults"
            @load-more="loadMoreSearchResults"
            @match-tap="openMatchDetail"
          />
        </template>
        <view v-else-if="errorMessage" class="hall-empty">
          <view>{{ errorMessage }}</view>
          <view class="hall-empty-action" @tap="loadPageData()">点击重试</view>
        </view>

        <template v-else>
          <HallCalendarStrip
            :days="calendarDays"
            :selected-key="selectedDateKey"
            @select="selectDate"
          />

          <view class="hall-toolbar-row">
            <view class="hall-toolbar-filters">
              <HallQuickFilters
                :active-kind="activeKind"
                :active-size="activeSize"
                @select-kind="selectKind"
                @select-size="selectSize"
              />
            </view>
          </view>

          <!-- 审核隐藏期不显示发布入口（与底栏创建按钮一致）；独立成行的主按钮，游客仍显示并引导登录。 -->
          <view v-if="canOpenPublishSheet" class="hall-publish-row">
            <AppButton block variant="lime" @click="openPublishTypeSheet">发布约队 / 散人约球</AppButton>
          </view>

          <SectionHeader title="可加入的比赛" />

          <!-- key 绑定筛选组合：仅筛选变化时重播轻淡入；加载更多追加不清空不重播。 -->
          <HallMatchList
            :key="`${activeKind}-${activeSize}-${selectedDateKey}`"
            class="hall-list-transition"
            :cards="hallCards"
            @match-tap="openMatchDetail"
          />

          <view v-if="!hallCards.length" class="hall-empty hall-empty-spacious">
            {{ hasMore ? "本页没有符合筛选条件的约队，可以加载更多继续找。" : "当前筛选条件下还没有可加入的约队，换个日期或类型再看看。" }}
          </view>

          <!-- 所有筛选只作用于已加载页：过滤后为空但还有下一页时，入口不能消失。 -->
          <view v-if="hasMore" class="hall-load-more" @tap="loadMore">
            {{ isLoadingMore ? "加载中..." : "加载更多" }}
          </view>
        </template>
      </template>
    </view>
    </AppPullScrollView>

    <PublishTypeSheet
      :visible="publishTypeSheetVisible"
      :team-publish-disabled="!hasPublishIdentity"
      @close="closePublishTypeSheet"
      @publish-team="handlePublishTeamChallenge"
      @publish-individual="handlePublishIndividualChallenge"
    />

    <!-- 散人点击“球队约队”时的身份引导弹窗（统一风格，单按钮提示）。 -->
    <ConfirmDialog
      :visible="confirmDialogVisible"
      :title="confirmDialogState.title"
      :message="confirmDialogState.message"
      :highlight="confirmDialogState.highlight"
      :link-text="confirmDialogState.linkText"
      :image-src="confirmDialogState.imageSrc"
      :image-caption="confirmDialogState.imageCaption"
      :second-image-src="confirmDialogState.secondImageSrc"
      :second-image-caption="confirmDialogState.secondImageCaption"
      :primary-text="confirmDialogState.primaryText"
      :secondary-text="confirmDialogState.secondaryText"
      :primary-tone="confirmDialogState.primaryTone"
      @primary="handleConfirmPrimary"
      @secondary="handleConfirmSecondary"
      @close="handleConfirmClose"
      @link="handleConfirmLink"
    />

    <BottomTabBar current="challenge" />
  </view>
</template>

<style scoped>
.hall-page {
  position: relative;
  min-height: 100vh;
  padding: 0 28rpx;
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.hall-content {
  position: relative;
  /* 滚动收进 AppPullScrollView 后，底栏留白由滚动内容自己承担。 */
  padding-bottom: var(--ui-tabbar-clearance);
}

.hall-search-scope { display: block; color: var(--ui-color-text-muted); font-size: 22rpx; line-height: 1.5; }

.hall-toolbar-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin-top: 20rpx;
}

.hall-toolbar-filters {
  flex: 1;
  min-width: 0;
}

/* 发布入口独立成行：小尺寸角落按钮用户难以感知可点击。 */
.hall-publish-row {
  margin-top: 20rpx;
}

.hall-guest-card {  margin-top: 24rpx;
  padding: 32rpx 28rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-raised);
}

.hall-guest-title {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: var(--ui-color-text);
}

.hall-guest-subtitle {  display: block;
  margin-top: 12rpx;
  margin-bottom: 26rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: var(--ui-color-text-muted);
  font-weight: 400;
}

.hall-empty {  margin-top: 24rpx;
  padding: 28rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text-muted);
  font-size: 28rpx;
  line-height: 1.6;
}

.hall-empty-spacious {
  margin-top: 20rpx;
  margin-bottom: 24rpx;
  font-size: 26rpx;
}

.hall-empty-action {  display: inline-flex;
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

.hall-load-more {  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 24rpx;
  margin-bottom: 16rpx;
  height: 64rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 500;
}

/* 筛选变化时列表内容轻淡入：不超过 8rpx 位移，控件本身不动。 */
.hall-list-transition {
  animation: hall-list-fade-in 160ms ease;
}

@keyframes hall-list-fade-in {
  from {
    opacity: 0;
    transform: translateY(6rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* H5 减少动态效果：列表直接切换。 */
@media (prefers-reduced-motion: reduce) {
  .hall-list-transition {
    animation: none;
  }
}

/* #ifdef H5 */
.hall-page {
  width: 100%;
  max-width: 750rpx;
  margin: 0 auto;
}

.hall-page :deep(.app-tab-header-shell) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */
</style>
