<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import { computed, ref } from "vue";
import { onLoad, onReachBottom, onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import { listMyMatches } from "@/api/match";
import type { AppMatchUiPhase } from "@/types/match";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { getCustomNavMetrics } from "@/utils/customNav";
import { toHomeMatchCard } from "../homeMatchState";
import HomeMatchList from "../components/HomeMatchList.vue";
import {
  filterVisiblePhaseMatches,
  isHomeMatchPaginationComplete,
  loadNextVisiblePhaseBatch,
  type HomeMatchPaginationState,
} from "./homeMatchPagination";

const { themePageStyle } = useAccentTheme();

type VisibleHomeMatchPhase = Exclude<AppMatchUiPhase, "excluded">;

const MATCH_PAGE_SIZE = 20;
const PHASE_META: Record<VisibleHomeMatchPhase, { title: string; emptyText: string }> = {
  upcoming: {
    title: "最近要处理的比赛",
    emptyText: "暂时没有要处理的比赛。",
  },
  ongoing: {
    title: "进行中的比赛",
    emptyText: "暂时没有进行中的比赛。",
  },
  ended: {
    title: "已结束的比赛",
    emptyText: "暂时没有已结束的比赛。",
  },
};

const navMetrics = getCustomNavMetrics();

const phase = ref<VisibleHomeMatchPhase>("upcoming");
const paginationState = ref<HomeMatchPaginationState>({
  sourceItems: [],
  nextPage: 1,
  total: 0,
  pageSize: MATCH_PAGE_SIZE,
});
const phaseClock = ref(new Date());
const hasInitialized = ref(false);
const isLoading = ref(false);
const errorMessage = ref("");
const navigatingMatchId = ref("");

const pageMeta = computed(() => PHASE_META[phase.value]);
const contentStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));
const sourceLoaded = computed(() => isHomeMatchPaginationComplete(paginationState.value));
const visibleMatches = computed<HomeMatchCardViewModel[]>(() =>
  filterVisiblePhaseMatches(paginationState.value.sourceItems, phase.value, phaseClock.value).map((item) => toHomeMatchCard(item, phase.value)),
);
const showEmptyState = computed(() => !visibleMatches.value.length && !isLoading.value && !errorMessage.value && sourceLoaded.value);
const footerText = computed(() => {
  if (errorMessage.value) return "加载失败，点击重试";
  if (isLoading.value) return "加载更多...";
  if (sourceLoaded.value) return "没有更多比赛了";
  return "下滑继续加载更多";
});

function normalizePhase(value: unknown): VisibleHomeMatchPhase {
  return value === "ongoing" || value === "ended" ? value : "upcoming";
}

function resetPaginationState() {
  paginationState.value = {
    sourceItems: [],
    nextPage: 1,
    total: 0,
    pageSize: MATCH_PAGE_SIZE,
  };
  phaseClock.value = new Date();
  errorMessage.value = "";
}

async function loadVisiblePhaseBatch() {
  if (isLoading.value || sourceLoaded.value) return;

  isLoading.value = true;
  errorMessage.value = "";

  try {
    paginationState.value = await loadNextVisiblePhaseBatch(
      paginationState.value,
      phase.value,
      phaseClock.value,
      (page, pageSize) => listMyMatches({ page, pageSize }),
    );
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : `${pageMeta.value.title}加载失败`;
  } finally {
    isLoading.value = false;
  }
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

function handleFooterTap() {
  if (isLoading.value) return;
  if (errorMessage.value) {
    void loadVisiblePhaseBatch();
    return;
  }
  if (!sourceLoaded.value) {
    void loadVisiblePhaseBatch();
  }
}

onLoad((options) => {
  phase.value = normalizePhase(options?.phase);
});

onShow(() => {
  if (hasInitialized.value) return;
  hasInitialized.value = true;
  resetPaginationState();
  void loadVisiblePhaseBatch();
});

onReachBottom(() => {
  if (!hasInitialized.value || errorMessage.value || isLoading.value || sourceLoaded.value) return;
  void loadVisiblePhaseBatch();
});
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="phase-matches-page">
    <AppTabHeader :title="pageMeta.title" showBack />

    <view class="phase-matches-content" :style="contentStyle">
      <HomeMatchList
        v-if="visibleMatches.length"
        :matches="visibleMatches"
        :is-guest-mode="false"
        :navigating-match-id="navigatingMatchId"
        @match-tap="handleMatchTap"
      />

      <view v-if="showEmptyState" class="empty-card">
        <text class="empty-text">{{ pageMeta.emptyText }}</text>
      </view>

      <view
        class="phase-footer"
        :class="{ 'phase-footer-error': !!errorMessage }"
        @tap="handleFooterTap"
      >
        <text class="phase-footer-text">{{ footerText }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.phase-matches-page {
  min-height: 100vh;
  padding: 0 28rpx 96rpx;
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.empty-card,
.phase-footer {
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
}

.empty-card,
.phase-footer {
  margin-top: 22rpx;
  padding: 28rpx;
  box-sizing: border-box;
}

.empty-card {
  text-align: center;
}

.empty-text,
.phase-footer-text {
  color: var(--neo-color-text-muted);
  font-size: 28rpx;
  line-height: 1.5;
  font-weight: 800;
}

.phase-footer {
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.phase-footer-error {
  background: var(--neo-color-danger-soft);
}

/* #ifdef H5 */
.phase-matches-page {
  width: 100%;
  max-width: 750rpx;
  margin: 0 auto;
}

.phase-matches-page :deep(.app-tab-header-shell) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */
</style>
