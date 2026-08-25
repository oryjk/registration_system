<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import NeoSegmentedControl from "@/components/neo/NeoSegmentedControl.vue";
import HomeMatchList from "@/pages/home/components/HomeMatchList.vue";
import { useTeamContext } from "@/stores/teamContext";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { getCustomNavMetrics } from "@/utils/customNav";
import { loadAllMyMatches } from "../myMatchesData";
import { buildUserMatchCards, type UserMatchScope } from "./userMatchesState";

const { themePageStyle } = useAccentTheme();

const { ensureSessionReady } = useTeamContext();
const navMetrics = getCustomNavMetrics();

const isLoading = ref(false);
const errorMessage = ref("");
const matchScope = ref<UserMatchScope>("future");
const matches = ref<HomeMatchCardViewModel[]>([]);
const navigatingMatchId = ref("");

const contentStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

const scopeOptions = [
  { label: "未结束", value: "future" },
  { label: "已结束", value: "past" },
];

const heroCopy = computed(() =>
  matchScope.value === "future"
    ? "展示进行中及待开始的比赛，按时间顺序排列。"
    : "展示已经结束的比赛，方便回看历史记录。",
);
const emptyText = computed(() =>
  matchScope.value === "future" ? "暂时没有未结束的相关比赛。" : "暂时没有已结束的相关比赛。",
);

function handleScopeChange(value: string) {
  matchScope.value = value === "past" ? "past" : "future";
  void loadPageData();
}

function handleMatchTap(match: HomeMatchCardViewModel) {
  if (navigatingMatchId.value) return;

  navigatingMatchId.value = match.id;
  uni.navigateTo({
    url: match.detailUrl,
    complete: () => {
      setTimeout(() => {
        navigatingMatchId.value = "";
      }, 300);
    },
  });
}

async function loadPageData() {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    await ensureSessionReady();
    const allMatches = await loadAllMyMatches();
    matches.value = buildUserMatchCards({
      matches: allMatches,
      scope: matchScope.value,
    });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "我的比赛加载失败";
  } finally {
    isLoading.value = false;
  }
}

onShow(() => {
  void loadPageData();
});
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="my-matches-page">
    <AppTabHeader title="我的比赛" showBack />
    <view class="my-matches-content" :style="contentStyle">
      <view class="page-hero">
        <text class="page-title">我的比赛</text>
        <text class="page-copy">{{ heroCopy }}</text>
      </view>

      <NeoSegmentedControl
        :model-value="matchScope"
        :options="scopeOptions"
        class="scope-segment"
        @update:model-value="handleScopeChange"
      />

      <view v-if="isLoading" class="empty-card">
        <text class="empty-text">正在加载我的比赛...</text>
      </view>
      <view v-else-if="errorMessage" class="empty-card" @tap="loadPageData">
        <text class="empty-text">{{ errorMessage }}，点击重试</text>
      </view>
      <view v-else-if="!matches.length" class="empty-card">
        <text class="empty-text">{{ emptyText }}</text>
      </view>
      <HomeMatchList
        v-else
        :matches="matches"
        :is-guest-mode="false"
        :navigating-match-id="navigatingMatchId"
        @match-tap="handleMatchTap"
      />
    </view>
  </view>
</template>

<style scoped>
.my-matches-page {
  min-height: 100vh;
  padding: 0 28rpx 96rpx;
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.page-hero,
.empty-card {
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
}

.page-hero {
  padding: 28rpx;
}

.page-title {
  display: block;
  color: var(--neo-color-text);
  font-size: 48rpx;
  line-height: 1.15;
  font-weight: 900;
}

.page-copy {
  display: block;
  margin-top: 12rpx;
  color: var(--neo-color-text-muted);
  font-size: 26rpx;
  line-height: 1.5;
  font-weight: 700;
}

.scope-segment {
  margin-top: 18rpx;
}

.empty-card {
  margin-top: 18rpx;
  padding: 44rpx 28rpx;
  text-align: center;
}

.empty-text {
  color: var(--neo-color-text-muted);
  font-size: 28rpx;
  line-height: 1.5;
  font-weight: 800;
}

/* #ifdef H5 */
.my-matches-page {
  width: 100%;
  max-width: 750rpx;
  margin: 0 auto;
}

.my-matches-page :deep(.app-tab-header-shell) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */
</style>
