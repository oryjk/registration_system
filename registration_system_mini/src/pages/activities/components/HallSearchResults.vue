<script setup lang="ts">
import { getCurrentInstance, nextTick, onBeforeUnmount, onMounted, watch } from "vue";
import type { HallMatchCardViewModel } from "../hallMatchState";
import { shouldAutoLoadHomeMatchSearchPage } from "../../home/homeMatchSearchState";
import HallMatchList from "./HallMatchList.vue";
import HallEmptyState from "./HallEmptyState.vue";

const props = defineProps<{
  hasSearched: boolean;
  isLoading: boolean;
  isGuestMode: boolean;
  matches: HallMatchCardViewModel[];
  errorMessage: string;
  hasMore: boolean;
  createLabel?: string;
}>();

const emit = defineEmits<{
  (event: "retry"): void;
  (event: "loadMore"): void;
  (event: "matchTap", match: HallMatchCardViewModel): void;
  (event: "clear"): void;
  (event: "create"): void;
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
    .observe(".hall-search-results__sentinel", (result) => {
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
  <!-- 搜索范围为大厅可加入的比赛，以及当前用户相关的全部比赛。 -->
  <view v-if="hasSearched" class="hall-search-results">
    <view v-if="isGuestMode" class="hall-search-results__state">
      登录后可搜索你有权限查看的全部比赛。
    </view>
    <view v-else-if="isLoading && !matches.length" class="hall-search-results__state">正在搜索比赛...</view>
    <view v-else-if="errorMessage && !matches.length" class="hall-search-results__state hall-search-results__state--error">
      <text>{{ errorMessage }}</text>
      <view class="hall-search-results__retry" @tap="emit('retry')">点击重试</view>
    </view>
    <view v-else-if="matches.length" class="hall-search-results__list">
      <text class="hall-search-results__caption">已找到 {{ matches.length }} 场{{ hasMore ? " · 下滑继续加载" : "" }}</text>
      <HallMatchList
        :cards="matches"
        @match-tap="emit('matchTap', $event)"
      />
      <view class="hall-search-results__sentinel">
        <view v-if="errorMessage" class="hall-search-results__footer hall-search-results__footer--error">
          <text>{{ errorMessage }}</text>
          <view class="hall-search-results__retry" @tap="emit('retry')">点击重试</view>
        </view>
        <view v-else-if="isLoading" class="hall-search-results__footer">正在加载更多...</view>
        <view v-else-if="hasMore" class="hall-search-results__footer">继续下滑加载更多</view>
        <view v-else class="hall-search-results__footer">已显示全部搜索结果</view>
      </view>
    </view>
    <HallEmptyState
      v-else
      title="没找到匹配的比赛"
      description="换个关键词再试试，或者自己发起一场，让合适的人来找到你。"
      primary-label="清空搜索"
      :secondary-label="createLabel"
      @primary="emit('clear')"
      @secondary="emit('create')"
    />
  </view>
</template>

<style scoped>
.hall-search-results {
  margin-top: 24rpx;
}

.hall-search-results__caption {
  display: block;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 400;
}

.hall-search-results__state {
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

.hall-search-results__state--error {
  background: var(--ui-color-danger-soft);
  color: var(--ui-color-text);
}

.hall-search-results__footer {
  padding: 24rpx 0 8rpx;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 400;
  text-align: center;
}

.hall-search-results__footer--error {
  color: var(--ui-color-text);
}

.hall-search-results__retry {
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
