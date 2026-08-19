<script setup lang="ts">
import { onHide, onLoad, onShow, onUnload, onShareAppMessage, onShareTimeline } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import ActivitiesSkeleton from "./components/ActivitiesSkeleton.vue";
import HallCalendarStrip from "./components/HallCalendarStrip.vue";
import HallQuickFilters from "./components/HallQuickFilters.vue";
import HallMatchList from "./components/HallMatchList.vue";
import PublishTypeSheet from "./components/PublishTypeSheet.vue";
import { useHallPage } from "./useHallPage";
import { getCustomNavMetrics } from "@/utils/customNav";
import { DEFAULT_SHARE_IMAGE_URL } from "@/utils/share";
import { computed, ref } from "vue";

const {
  showInitialLoadingState,
  isLoadingMore,
  errorMessage,
  isGuestMode,
  canPublish,
  hallCards,
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

const navMetrics = getCustomNavMetrics();
const publishTypeSheetVisible = ref(false);
const navigatingMatchId = ref("");
const shareTitle = "约队大厅：看看可报名的散人局";
const sharePath = "/pages/activities/index";
const pageStyle = computed(() => ({
  padding: "0 28rpx 180rpx",
}));
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
  if (!canPublish.value) {
    uni.showToast({
      title: "请先在我的页面选择球队或场馆身份",
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
  uni.hideTabBar({ animation: false });
  startWindowTimer();
  void loadPageData({ preserveContent: true });
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
</script>

<template>
  <view class="hall-page" :style="pageStyle">
    <AppTabHeader title="约队大厅" />

    <view class="hall-content" :style="contentStyle">
      <ActivitiesSkeleton v-if="showInitialLoadingState" />

      <view v-else-if="isGuestMode" class="hall-guest-card">
        <text class="hall-guest-title">登录后查看约队大厅</text>
        <text class="hall-guest-subtitle">浏览球队约队和散人约局，报名凑局一场就出发。</text>
        <NeoButton block @click="handleLogin">立即登录</NeoButton>
      </view>

      <template v-else>
        <view v-if="errorMessage" class="hall-empty">
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
            <view class="hall-publish-button" @tap="openPublishTypeSheet">发布</view>
          </view>

          <NeoSectionHeader title="可加入的比赛" marker="约" />

          <HallMatchList
            :cards="hallCards"
            @match-tap="openMatchDetail"
          />

          <view v-if="!hallCards.length" class="hall-empty hall-empty-spacious">
            {{ hasMore ? "本页没有符合筛选条件的约队，可以加载更多继续找。" : "当前筛选条件下还没有可加入的约队，换个日期或类型再看看。" }}
          </view>

          <!-- 类型/人数是前端过滤，只作用于已加载页：过滤后为空但还有下一页时，入口不能消失。 -->
          <view v-if="hasMore" class="hall-load-more" @tap="loadMore">
            {{ isLoadingMore ? "加载中..." : "加载更多" }}
          </view>
        </template>
      </template>
    </view>

    <PublishTypeSheet
      :visible="publishTypeSheetVisible"
      @close="closePublishTypeSheet"
      @publish-team="handlePublishTeamChallenge"
      @publish-individual="handlePublishIndividualChallenge"
    />

    <BottomTabBar current="challenge" />
  </view>
</template>

<style scoped>
.hall-page {
  position: relative;
  min-height: 100vh;
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.hall-content {
  position: relative;
}

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

.hall-publish-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 104rpx;
  height: 56rpx;
  flex-shrink: 0;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-text);
  color: var(--neo-color-text-inverse);
  font-size: 24rpx;
  font-weight: 900;
  box-shadow: 4rpx 4rpx 0 var(--neo-color-accent);
  transition: transform var(--neo-motion-fast), box-shadow var(--neo-motion-fast);
}

.hall-publish-button:active {
  transform: translate(var(--neo-motion-press-offset), var(--neo-motion-press-offset));
  box-shadow: var(--neo-shadow-pressed);
}

.hall-guest-card {
  margin-top: 24rpx;
  padding: 32rpx 28rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
}

.hall-guest-title {
  display: block;
  font-size: 34rpx;
  font-weight: 900;
  color: var(--neo-color-text);
}

.hall-guest-subtitle {
  display: block;
  margin-top: 12rpx;
  margin-bottom: 26rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: var(--neo-color-text-muted);
  font-weight: 600;
}

.hall-empty {
  margin-top: 24rpx;
  padding: 28rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text-muted);
  font-size: 28rpx;
  line-height: 1.6;
}

.hall-empty-spacious {
  margin-top: 20rpx;
  margin-bottom: 24rpx;
  font-size: 26rpx;
}

.hall-empty-action {
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

.hall-load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 24rpx;
  margin-bottom: 16rpx;
  height: 64rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 26rpx;
  font-weight: 800;
}

/* #ifdef H5 */
.hall-page {
  width: 100%;
  max-width: 750rpx;
  margin: 0 auto;
}

.hall-page :deep(.app-tab-header-shell),
.hall-page :deep(.custom-tabbar) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */
</style>
