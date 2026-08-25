<script setup lang="ts">
import type { CaptainThreadItemViewModel } from "../captainThreadListState";

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
      <view
        v-for="item in items"
        :key="item.id"
        class="threads-card threads-item"
        @tap="emit('open', item.id)"
      >
        <view class="threads-item-top">
          <view class="threads-item-user">
            <image
              v-if="item.avatarUrl"
              class="threads-avatar"
              :src="item.avatarUrl"
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

      <view v-if="!items.length" class="threads-card">还没有球队留言。在比赛详情页点「联系队长」即可给对方队长留言。</view>
      <view v-else-if="hasMore" class="threads-more" @tap="emit('loadMore')">
        {{ isLoadingMore ? "加载中..." : "加载更多" }}
      </view>
      <view v-else class="threads-more threads-more-end">没有更多了</view>
    </template>
  </view>
</template>

<style scoped>
.threads-section {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 20rpx;
}

.threads-card {
  padding: 24rpx;
  border-radius: 30rpx;
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
  color: #6c7168;
  font-size: 28rpx;
  line-height: 1.6;
}

.threads-action {
  display: inline-flex;
  margin-top: 14rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: #eef1ea;
  color: #232620;
  font-size: 24rpx;
  font-weight: 800;
}

.threads-item {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
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
  flex-shrink: 0;
  background: #eef1ea;
}

.threads-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #232620;
  font-size: 30rpx;
  font-weight: 900;
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

.threads-item-unread {
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  background: #ffe8eb;
  color: #cf465d;
  font-size: 21rpx;
  font-weight: 900;
  line-height: 1.5;
}

.threads-item-title {
  font-size: 29rpx;
  color: #171814;
  font-weight: 900;
}

.threads-item-subtitle {
  font-size: 23rpx;
  color: #787d74;
  font-weight: 700;
}

.threads-item-time {
  flex-shrink: 0;
  font-size: 22rpx;
  color: #787d74;
  font-weight: 700;
}

.threads-item-preview {
  font-size: 26rpx;
  color: #60655d;
  line-height: 1.55;
}

.threads-item-action {
  font-size: 22rpx;
  color: #171814;
  font-weight: 800;
}

.threads-more {
  padding: 18rpx;
  border-radius: 28rpx;
  background: #ffffff;
  color: #171814;
  font-size: 26rpx;
  font-weight: 800;
  text-align: center;
}

.threads-more-end {
  color: #787d74;
}
</style>
