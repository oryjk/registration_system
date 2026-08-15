<script setup lang="ts">
import { getCurrentInstance, nextTick, onBeforeUnmount, onMounted, watch } from "vue";
import { NeoButton } from "@/components/neo";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { shouldAutoLoadHomeMatchSearchPage } from "../homeMatchSearchState";
import HomeMatchList from "./HomeMatchList.vue";

const props = defineProps<{
  query: string;
  isLoading: boolean;
  hasSearched: boolean;
  isGuestMode: boolean;
  navigatingMatchId: string;
  matches: HomeMatchCardViewModel[];
  errorMessage: string;
  hasMore: boolean;
  total: number;
}>();

const emit = defineEmits<{
  (event: "update:query", value: string): void;
  (event: "search"): void;
  (event: "clear"): void;
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
    .observe(".home-match-search__sentinel", (result) => {
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

function updateQuery(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  emit("update:query", detail.detail?.value ?? "");
}

function handleSearch() {
  emit("search");
}
</script>

<template>
  <view class="home-match-search">
    <view class="home-match-search__bar">
      <text class="home-match-search__icon">搜</text>
      <input
        :value="query"
        class="home-match-search__input"
        placeholder="搜索比赛名称或地点"
        confirm-type="search"
        @input="updateQuery"
        @confirm="handleSearch"
      />
      <view v-if="query" class="home-match-search__clear" @tap="emit('clear')">×</view>
      <NeoButton
        class="home-match-search__button"
        variant="lime"
        size="sm"
        :loading="isLoading"
        @click="handleSearch"
      >
        {{ isLoading ? "搜索中" : "搜索" }}
      </NeoButton>
    </view>

    <view v-if="hasSearched" class="home-match-search__results">
      <view v-if="isGuestMode" class="home-match-search__state">
        登录后可搜索你有权限查看的全部比赛。
      </view>
      <view v-else-if="isLoading && !matches.length" class="home-match-search__state">正在搜索比赛...</view>
      <view v-else-if="errorMessage && !matches.length" class="home-match-search__state home-match-search__state--error">
        <text>{{ errorMessage }}</text>
        <view class="home-match-search__retry" @tap="emit('retry')">点击重试</view>
      </view>
      <view v-else-if="matches.length" class="home-match-search__list">
        <text class="home-match-search__caption">搜索结果 {{ total }} 场 · 按开始时间倒序</text>
        <HomeMatchList
          :matches="matches"
          :is-guest-mode="false"
          :navigating-match-id="navigatingMatchId"
          @match-tap="emit('matchTap', $event)"
        />
        <view class="home-match-search__sentinel">
          <view v-if="errorMessage" class="home-match-search__footer home-match-search__footer--error">
            <text>{{ errorMessage }}</text>
            <view class="home-match-search__retry" @tap="emit('retry')">点击重试</view>
          </view>
          <view v-else-if="isLoading" class="home-match-search__footer">正在加载更多...</view>
          <view v-else-if="hasMore" class="home-match-search__footer">继续下滑加载更多</view>
          <view v-else class="home-match-search__footer">已经捅到底了</view>
        </view>
      </view>
      <view v-else class="home-match-search__state">没有找到名称或地点匹配的比赛。</view>
    </view>
  </view>
</template>

<style scoped>
.home-match-search {
  margin-top: 24rpx;
}

.home-match-search__bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-height: 76rpx;
  padding: 8rpx 10rpx 8rpx 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
}

.home-match-search__icon {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 900;
}

.home-match-search__input {
  min-width: 0;
  flex: 1;
  color: var(--neo-color-text);
  font-size: 26rpx;
}

.home-match-search__clear {
  display: flex;
  width: 40rpx;
  height: 40rpx;
  align-items: center;
  justify-content: center;
  border-radius: var(--neo-radius-round);
  background: var(--neo-color-muted);
  color: var(--neo-color-text-muted);
  font-size: 30rpx;
  line-height: 1;
}

.home-match-search__button {
  flex-shrink: 0;
}

.home-match-search__results {
  margin-top: 24rpx;
}

.home-match-search__caption {
  display: block;
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 900;
}

.home-match-search__list :deep(.match-list) {
  margin-top: 14rpx;
}

.home-match-search__state {
  margin-top: 14rpx;
  padding: 22rpx 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text-muted);
  font-size: 25rpx;
  font-weight: 700;
  line-height: 1.5;
}

.home-match-search__state--error {
  background: var(--neo-color-danger-soft);
  color: var(--neo-color-text);
}

.home-match-search__footer {
  padding: 24rpx 0 8rpx;
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 700;
  text-align: center;
}

.home-match-search__footer--error {
  color: var(--neo-color-text);
}

.home-match-search__retry {
  display: inline-flex;
  margin-top: 10rpx;
  padding: 8rpx 14rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-weight: 900;
}
</style>
