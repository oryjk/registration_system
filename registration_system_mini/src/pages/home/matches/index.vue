<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onReachBottom, onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import { listMyMatches } from "@/api/match";
import type { AppMatchSummary, AppMatchUiPhase } from "@/types/match";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { getCustomNavMetrics } from "@/utils/customNav";
import { formatWeekdayLabel } from "@/utils/datetime";
import { attendanceStatusTone } from "@/utils/statusTone";
import { groupMatchesByPhase, toGoHomeMatchCard } from "../homeMatchState";
import HomeMatchList from "../components/HomeMatchList.vue";
import { loadNextVisiblePhaseBatch, type HomeMatchPaginationState } from "./homeMatchPagination";

type VisibleHomeMatchPhase = Exclude<AppMatchUiPhase, "excluded">;

const MATCH_PAGE_SIZE = 20;
const PHASE_META: Record<VisibleHomeMatchPhase, { title: string; copy: string; emptyText: string }> = {
  upcoming: {
    title: "报名中的比赛",
    copy: "从我的比赛里持续往后扫描，直到这一阶段出现新的可见比赛。",
    emptyText: "暂时没有报名中的比赛。",
  },
  ongoing: {
    title: "进行中的比赛",
    copy: "只按 Go 的我的比赛分页继续加载，保持阶段内排序和卡片样式一致。",
    emptyText: "暂时没有进行中的比赛。",
  },
  ended: {
    title: "已结束的比赛",
    copy: "会继续跨页扫描历史比赛，直到出现这一阶段的新记录或源数据耗尽。",
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
const phaseClock = ref(new Date("2026-08-09T12:00:00.000Z"));
const hasInitialized = ref(false);
const isLoading = ref(false);
const errorMessage = ref("");
const navigatingMatchId = ref("");

const pageMeta = computed(() => PHASE_META[phase.value]);
const contentStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));
const sourceLoaded = computed(() =>
  (paginationState.value.total > 0 && paginationState.value.sourceItems.length >= paginationState.value.total)
  || (hasInitialized.value && paginationState.value.sourceItems.length === 0 && paginationState.value.nextPage > 1),
);
const visibleMatches = computed<HomeMatchCardViewModel[]>(() => {
  const grouped = groupMatchesByPhase(paginationState.value.sourceItems, phaseClock.value);
  return grouped[phase.value].map((item) => toGoHomeMatchCard(item as AppMatchSummary, phase.value));
});
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

function progressBaseWidth(joinedPlayers: number, requiredPlayers: number, maxPlayers: number) {
  const denominator = Math.max(maxPlayers || requiredPlayers, 1);
  return `${Math.min((Math.min(joinedPlayers, requiredPlayers) / denominator) * 100, 100)}%`;
}

function progressExtraWidth(joinedPlayers: number, requiredPlayers: number, maxPlayers: number) {
  const denominator = Math.max(maxPlayers || requiredPlayers, 1);
  return `${Math.min((Math.max(joinedPlayers - requiredPlayers, 0) / denominator) * 100, 100)}%`;
}

function progressSplitLeft(requiredPlayers: number, maxPlayers: number) {
  const denominator = Math.max(maxPlayers || requiredPlayers, 1);
  return `${Math.min((requiredPlayers / denominator) * 100, 100)}%`;
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

function formatMatchDateBlock(dateLabel: string) {
  const [monthDay = "", timeLabel = ""] = dateLabel.split(" ");
  const [month = "01", day = "01"] = monthDay.split("/");
  const weekday = formatWeekdayLabel(`2026-${month}-${day}T00:00:00`);

  return {
    monthDay,
    weekday,
    timeLabel,
  };
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
    url: `/pages/matches/detail?id=${match.id}`,
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
  <view class="phase-matches-page">
    <AppTabHeader :title="pageMeta.title" showBack />

    <view class="phase-matches-content" :style="contentStyle">
      <view class="page-hero">
        <text class="page-title">{{ pageMeta.title }}</text>
        <text class="page-copy">{{ pageMeta.copy }}</text>
      </view>

      <HomeMatchList
        v-if="visibleMatches.length"
        :matches="visibleMatches"
        :is-guest-mode="false"
        :navigating-match-id="navigatingMatchId"
        :format-match-date-block="formatMatchDateBlock"
        :progress-base-width="progressBaseWidth"
        :progress-extra-width="progressExtraWidth"
        :progress-split-left="progressSplitLeft"
        :stage-class="stageClass"
        :status-class="statusClass"
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
  background:
    radial-gradient(circle at top left, rgba(200, 255, 0, 0.12), transparent 24%),
    linear-gradient(180deg, #ffffff 0%, #f4f5f0 100%);
  box-sizing: border-box;
}

.page-hero,
.empty-card,
.phase-footer {
  border-radius: 30rpx;
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.page-hero {
  padding: 28rpx;
}

.page-title {
  display: block;
  color: #111310;
  font-size: 48rpx;
  line-height: 1.15;
  font-weight: 900;
}

.page-copy {
  display: block;
  margin-top: 12rpx;
  color: #66705f;
  font-size: 26rpx;
  line-height: 1.5;
  font-weight: 700;
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
  color: #66705f;
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
  background: #fff8f2;
}
</style>
