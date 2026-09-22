<script setup lang="ts">
import { getCurrentInstance, nextTick, onBeforeUnmount, onMounted, watch } from "vue";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { shouldAutoLoadHomeMatchSearchPage } from "../homeMatchSearchState";
import HomeMatchList from "./HomeMatchList.vue";

const props = defineProps<{
  hasSearched: boolean;
  isLoading: boolean;
  isGuestMode: boolean;
  navigatingMatchId: string;
  matches: HomeMatchCardViewModel[];
  errorMessage: string;
  hasMore: boolean;
  total: number;
}>();

const emit = defineEmits<{
  (event: "retry"): void;
  (event: "loadMore"): void;
  (event: "matchTap", match: HomeMatchCardViewModel): void;
}>();

const componentProxy = getCurrentInstance()?.proxy;
let footerObserver: ReturnType<typeof uni.createIntersectionObserver> | null = null;
let stopFooterWatch: (() => void) | undefined;
let footerObserverVersion = 0;

function disconnectFooterObserver() {
  footerObserver?.disconnect();
  footerObserver = null;
}

async function refreshFooterObserver() {
  const observerVersion = ++footerObserverVersion;
  disconnectFooterObserver();

  if (
    !componentProxy ||
    !props.hasSearched ||
    props.isGuestMode ||
    !props.matches.length ||
    !props.hasMore ||
    props.isLoading ||
    !!props.errorMessage
  ) return;

  await nextTick();
  if (observerVersion !== footerObserverVersion) return;

  footerObserver = uni.createIntersectionObserver(componentProxy, {
    thresholds: [0, 0.01],
    initialRatio: 0,
  });
  footerObserver
    .relativeToViewport({ bottom: 160 })
    .observe(".home-match-search-results__sentinel", (result) => {
      if (shouldAutoLoadHomeMatchSearchPage({
        intersectionRatio: result.intersectionRatio,
        hasMore: props.hasMore,
        isLoading: props.isLoading,
        hasError: !!props.errorMessage,
      })) {
        emit("loadMore");
      }
    });
}

onMounted(() => {
  stopFooterWatch = watch(
    () => [
      props.hasSearched,
      props.isGuestMode,
      props.matches.length,
      props.hasMore,
      props.isLoading,
      props.errorMessage,
    ],
    () => {
      void refreshFooterObserver();
    },
    { immediate: true },
  );
});

onBeforeUnmount(() => {
  footerObserverVersion += 1;
  stopFooterWatch?.();
  disconnectFooterObserver();
});
</script>

<template>
  <!-- 搜索框在 header 扩展行（HomeHeaderSearch）；这里只承载结果与状态。 -->
  <view v-if="hasSearched" class="home-match-search-results">
    <view v-if="isGuestMode" class="home-match-search-results__state">
      登录后可搜索你有权限查看的全部比赛。
    </view>
    <view v-else-if="isLoading && !matches.length" class="home-match-search-results__state">正在搜索比赛...</view>
    <view v-else-if="errorMessage && !matches.length" class="home-match-search-results__state home-match-search-results__state--error">
      <text>{{ errorMessage }}</text>
      <view class="home-match-search-results__retry" @tap="emit('retry')">点击重试</view>
    </view>
    <view v-else-if="matches.length" class="home-match-search-results__list">
      <text class="home-match-search-results__caption">搜索结果 {{ total }} 场 · 按开始时间倒序</text>
      <HomeMatchList
        :matches="matches"
        :is-guest-mode="false"
        :navigating-match-id="navigatingMatchId"
        @match-tap="emit('matchTap', $event)"
      />
      <view class="home-match-search-results__sentinel">
        <view v-if="errorMessage" class="home-match-search-results__footer home-match-search-results__footer--error">
          <text>{{ errorMessage }}</text>
          <view class="home-match-search-results__retry" @tap="emit('retry')">点击重试</view>
        </view>
        <view v-else-if="isLoading" class="home-match-search-results__footer">正在加载更多...</view>
        <view v-else-if="hasMore" class="home-match-search-results__footer">继续下滑加载更多</view>
        <view v-else class="home-match-search-results__footer">已经捅到底了</view>
      </view>
    </view>
    <view v-else class="home-match-search-results__state">没有找到名称或地点匹配的比赛。</view>
  </view>
</template>

<style scoped>
.home-match-search-results {
  margin-top: 24rpx;
}

.home-match-search-results__caption {
  display: block;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 400;
}

.home-match-search-results__list :deep(.match-list) {
  margin-top: 14rpx;
}

.home-match-search-results__state {
  margin-top: 14rpx;
  padding: 22rpx 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text-muted);
  font-size: 25rpx;
  font-weight: 400;
  line-height: 1.5;
}

.home-match-search-results__state--error {
  background: var(--ui-color-danger-soft);
  color: var(--ui-color-text);
}

.home-match-search-results__footer {
  padding: 24rpx 0 8rpx;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 400;
  text-align: center;
}

.home-match-search-results__footer--error {
  color: var(--ui-color-text);
}

.home-match-search-results__retry {
  display: inline-flex;
  margin-top: 10rpx;
  padding: 8rpx 14rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  font-weight: 600;
}
</style>
