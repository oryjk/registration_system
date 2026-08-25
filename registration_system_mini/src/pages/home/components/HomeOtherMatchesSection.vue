<script setup lang="ts">
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import HomeMatchList from "./HomeMatchList.vue";

defineProps<{
  matches: HomeMatchCardViewModel[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasLoadedOnce: boolean;
  errorMessage: string;
  hasMore: boolean;
  navigatingMatchId: string;
}>();

const emit = defineEmits<{
  (event: "matchTap", match: HomeMatchCardViewModel): void;
  (event: "retry"): void;
  (event: "loadMore"): void;
}>();
</script>

<template>
  <view class="other-matches">
    <view v-if="errorMessage && !hasLoadedOnce" class="other-matches-empty" @tap="emit('retry')">
      <view>{{ errorMessage }}</view>
      <view class="other-matches-action">点击重试</view>
    </view>
    <view v-else-if="isLoading && !hasLoadedOnce" class="other-matches-empty">正在加载其他球队的比赛...</view>
    <template v-else>
      <HomeMatchList
        :matches="matches"
        :is-guest-mode="false"
        :navigating-match-id="navigatingMatchId"
        @match-tap="(match) => emit('matchTap', match)"
      />
      <view v-if="!matches.length" class="other-matches-empty">暂时没有其他球队的比赛，稍后再来看看。</view>
      <view v-else-if="hasMore" class="other-matches-more" @tap="emit('loadMore')">
        {{ isLoadingMore ? "加载中..." : "加载更多" }}
      </view>
      <view v-else class="other-matches-more other-matches-more-end">没有更多了</view>
    </template>
  </view>
</template>

<style scoped>
.other-matches {
  display: block;
}

.other-matches-empty {
  margin-top: 24rpx;
  padding: 28rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text-muted);
  font-size: 28rpx;
  line-height: 1.6;
}

.other-matches-action {
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

.other-matches-more {
  margin-top: 16rpx;
  padding: 18rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 26rpx;
  font-weight: 700;
  text-align: center;
}

.other-matches-more-end {
  color: var(--neo-color-text-muted);
}
</style>
