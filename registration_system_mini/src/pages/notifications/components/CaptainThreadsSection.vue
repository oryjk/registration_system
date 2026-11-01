<script setup lang="ts">
import { useMinioImages } from "@/composables/useMinioImages";
import AppSurface from "@/components/ui/AppSurface.vue";
import type { CaptainThreadItemViewModel } from "../captainThreadListState";

const { minioImageSrc } = useMinioImages();

defineProps<{
  items: CaptainThreadItemViewModel[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasLoadedOnce: boolean;
  errorMessage: string;
  hasMore: boolean;
}>();

const emit = defineEmits<{
  (event: "open", threadId: string): void;
  (event: "retry"): void;
  (event: "loadMore"): void;
}>();
</script>

<template>
  <view class="threads-section">
    <view v-if="errorMessage && !hasLoadedOnce" class="threads-card" @tap="emit('retry')">
      <view>{{ errorMessage }}</view>
      <view class="threads-action">点击重试</view>
    </view>
    <view v-else-if="isLoading && !hasLoadedOnce" class="threads-card">正在加载留言...</view>

    <template v-else>
      <view v-for="item in items" :key="item.id" class="threads-item-shell ui-list-row">
        <AppSurface
          variant="raised"
          interactive
          class="threads-item"
          @press="emit('open', item.id)"
        >
          <view class="threads-item-content">
            <view class="threads-item-top">
              <view class="threads-item-user">
                <image
                  v-if="item.avatarUrl"
                  class="threads-avatar"
                  :src="minioImageSrc(item.avatarUrl)"
                  mode="aspectFill"
                />
                <view v-else class="threads-avatar threads-avatar-fallback">{{ item.title.slice(0, 1) }}</view>
                <view class="threads-item-text">
                  <view class="threads-item-title-row">
                    <text class="threads-item-title">{{ item.title }}</text>
                    <text v-if="item.unread > 0" class="threads-item-unread">{{ item.unread > 99 ? "99+" : item.unread }}</text>
                  </view>
                  <text class="threads-item-subtitle">{{ item.subtitle }}</text>
                </view>
              </view>
              <text class="threads-item-time">{{ item.timeLabel }}</text>
            </view>
            <text class="threads-item-preview">{{ item.preview }}</text>
            <text class="threads-item-action">查看对话</text>
          </view>
        </AppSurface>
      </view>

      <view v-if="!items.length" class="threads-card">还没有球队留言。在比赛详情页点「联系队长」即可给对方队长留言。</view>
      <view v-else-if="hasMore" class="threads-more" @tap="emit('loadMore')">
        {{ isLoadingMore ? "加载中..." : "加载更多" }}
      </view>
      <view v-else class="threads-more threads-more-end">没有更多了</view>
    </template>
  </view>
</template>

<style scoped>
@import "@/styles/list-surfaces.css";
/* #ifdef H5 */
.threads-item-shell,.threads-item-content { display: contents; }
/* #endif */

.threads-section {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 22rpx;
}

.threads-card {
  padding: 26rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text-muted);
  font-size: 28rpx;
  line-height: 1.6;
  font-weight: 400;
}

.threads-action {
  display: inline-flex;
  margin-top: 14rpx;
  padding: 8rpx 16rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  font-size: 24rpx;
  font-weight: 500;
}

.threads-item {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 24rpx;
}

.threads-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.threads-item-user {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-width: 0;
}

.threads-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  border: var(--ui-border-default);
  flex-shrink: 0;
  background: var(--ui-color-accent-soft);
}

.threads-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ui-color-text);
  font-size: 30rpx;
  font-weight: 600;
}

.threads-item-text {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}

.threads-item-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.threads-item-title {
  font-size: 29rpx;
  color: var(--ui-color-text);
  font-weight: 600;
}

.threads-item-unread {
  padding: 2rpx 12rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-danger-soft);
  color: var(--ui-color-danger);
  font-size: 21rpx;
  font-weight: 600;
  line-height: 1.5;
}

.threads-item-subtitle {
  font-size: 23rpx;
  color: var(--ui-color-text-muted);
  font-weight: 400;
}

.threads-item-time {
  flex-shrink: 0;
  font-size: 22rpx;
  color: var(--ui-color-text-muted);
  font-weight: 400;
}

.threads-item-preview {
  font-size: 26rpx;
  color: var(--ui-color-text-muted);
  font-weight: 400;
  line-height: 1.55;
}

.threads-item-action {
  font-size: 22rpx;
  color: var(--ui-color-text);
  font-weight: 500;
}

.threads-more {
  padding: 18rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 500;
  text-align: center;
}

.threads-more-end {
  color: var(--ui-color-text-muted);
}

/* #ifdef MP-WEIXIN */
.threads-section { gap: 0; margin-top: var(--ui-space-4); }
.threads-item-shell { display: block; padding: 0; --ui-panel-padding: var(--ui-list-row-padding) 0; }
.threads-item-content { display: flex; flex-direction: column; gap: var(--ui-space-3); }
.threads-item-top { align-items: flex-start; gap: var(--ui-space-3); }
.threads-item-user { flex: 1; gap: var(--ui-list-row-gap); }
.threads-item-title-row { flex-wrap: wrap; gap: var(--ui-space-3); }
.threads-item-title { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); overflow-wrap: anywhere; }
.threads-item-subtitle { font-size: var(--ui-text-sm); overflow-wrap: anywhere; }
.threads-item-time,.threads-item-action { font-size: var(--ui-text-sm); }
.threads-item-unread { padding: var(--ui-space-1) var(--ui-space-3); border: var(--ui-control-border); background: var(--ui-color-danger-bg); color: var(--ui-color-danger-fg); font-size: var(--ui-text-xs); }
.threads-avatar { border: var(--ui-panel-border); background: var(--ui-control-subtle-bg); }
.threads-item-preview { font-size: var(--ui-text-label); line-height: var(--ui-line-height-body); overflow-wrap: anywhere; }
.threads-card { padding: var(--ui-space-6) 0; border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); font-size: var(--ui-text-body); line-height: var(--ui-line-height-body); }
.threads-action,.threads-more { min-height: var(--ui-control-min-height); padding: var(--ui-space-3) var(--ui-space-4); border: var(--ui-control-border); border-radius: var(--ui-control-radius); background: var(--ui-control-subtle-bg); font-size: var(--ui-text-body); }
.threads-more-end { background: transparent; }
/* #endif */
</style>
