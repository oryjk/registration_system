<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import { listNotifications, markAllNotificationsRead } from "@/api/notification";
import { setUnreadCount, syncUnreadCount } from "@/stores/notificationCenter";
import { ensureSessionReady } from "@/stores/appSession";
import type { BackendNotification } from "@/types/backend";
import { getCustomNavMetrics } from "@/utils/customNav";
import { buildNotificationItems } from "@/utils/viewModels";

const { themePageStyle } = useAccentTheme();

const navMetrics = getCustomNavMetrics();
const isLoading = ref(false);
const hasLoadedOnce = ref(false);
const errorMessage = ref("");
const unreadOnly = ref(false);
const notifications = ref<BackendNotification[]>([]);

const notificationItems = computed(() => buildNotificationItems(notifications.value));
const unreadCount = computed(() => notifications.value.filter((item) => !item.read_at).length);
const showInitialLoadingState = computed(() => isLoading.value && !hasLoadedOnce.value);
const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

async function loadNotifications() {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    await ensureSessionReady();
    notifications.value = await listNotifications({
      unreadOnly: unreadOnly.value,
      limit: 50,
    });

    if (notifications.value.some((item) => !item.read_at)) {
      await markAllNotificationsRead();
      notifications.value = notifications.value.map((item) => ({
        ...item,
        read_at: item.read_at ?? new Date().toISOString(),
      }));
    }
    setUnreadCount(0);
    await syncUnreadCount({ skipEnsure: true });
    hasLoadedOnce.value = true;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "通知加载失败";
  } finally {
    isLoading.value = false;
  }
}

function openNotification(path: string) {
  if (!path) return;
  uni.navigateTo({ url: path });
}

onShow(() => {
  void loadNotifications();
});
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="notice-page" :style="pageStyle">
    <AppTabHeader title="消息中心" showBack />

    <view class="notice-header">
      <view>
        <text class="notice-title">消息中心</text>
        <text class="notice-subtitle">约队事件、队费余额不足等提醒先沉淀在站内通知里。</text>
      </view>
      <view class="notice-header-badge">{{ unreadOnly ? "仅未读" : `${notificationItems.length} 条` }}</view>
    </view>

    <view class="notice-filter-row">
      <view :class="['notice-filter-chip', !unreadOnly ? 'notice-filter-chip-active' : '']" @tap="unreadOnly = false; void loadNotifications()">全部</view>
      <view :class="['notice-filter-chip', unreadOnly ? 'notice-filter-chip-active' : '']" @tap="unreadOnly = true; void loadNotifications()">仅看未读</view>
      <view class="notice-filter-meta">已自动清空红点</view>
    </view>

    <view v-if="errorMessage" class="notice-empty">{{ errorMessage }}</view>
    <view v-else-if="showInitialLoadingState" class="notice-skeleton-stack">
      <view class="notice-skeleton-hero">
        <view>
          <view class="notice-skeleton-line notice-skeleton-line-label" />
          <view class="notice-skeleton-line notice-skeleton-line-value" />
          <view class="notice-skeleton-line notice-skeleton-line-copy" />
        </view>
        <view class="notice-skeleton-pill" />
      </view>
      <view
        v-for="index in 4"
        :key="index"
        class="notice-skeleton-card"
      >
        <view class="notice-skeleton-row">
          <view class="notice-skeleton-line notice-skeleton-line-title" />
          <view class="notice-skeleton-pill small" />
        </view>
        <view class="notice-skeleton-line notice-skeleton-line-body" />
        <view class="notice-skeleton-line notice-skeleton-line-body short" />
      </view>
    </view>

    <view v-else class="notice-loaded-content">
      <view class="notice-hero">
        <view>
          <text class="notice-hero-label">通知状态</text>
          <text class="notice-hero-value">{{ unreadCount }}</text>
          <text class="notice-hero-copy">未读已经在进入页面时自动标记为已读。</text>
        </view>
        <view class="notice-hero-pill">站内消息</view>
      </view>

      <view v-if="notificationItems.length" class="notice-list">
        <view
          v-for="item in notificationItems"
          :key="item.id"
          class="notice-card"
          @tap="openNotification(item.relatedPath)"
        >
          <view class="notice-card-top">
            <text class="notice-card-title">{{ item.title }}</text>
            <text :class="['notice-kind-chip', item.read ? '' : 'notice-kind-chip-unread']">{{ item.kindLabel }}</text>
          </view>
          <text class="notice-card-copy">{{ item.content }}</text>
          <view class="notice-card-bottom">
            <text class="notice-card-time">{{ item.createdAtLabel }}</text>
            <text class="notice-card-action">{{ item.relatedPath ? "查看详情" : "已处理" }}</text>
          </view>
        </view>
      </view>
      <view v-else class="notice-empty">当前没有可展示的通知。</view>
    </view>
  </view>
</template>

<style scoped>
.notice-page {
  min-height: 100vh;
  padding: 30rpx 28rpx 100rpx;
  background:
    radial-gradient(circle at top right, rgba(200, 255, 0, 0.12), transparent 24%),
    linear-gradient(180deg, #fbfcf7 0%, #f2f4ed 100%);
  box-sizing: border-box;
}

.notice-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.notice-title {
  display: block;
  font-size: 64rpx;
  color: #131410;
  font-weight: 900;
}

.notice-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6d726a;
  line-height: 1.5;
  font-weight: 700;
}

.notice-header-badge {
  padding: 14rpx 20rpx;
  border-radius: 999rpx;
  background: #171814;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 800;
}

.notice-filter-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 22rpx;
  flex-wrap: wrap;
}

.notice-filter-chip {
  padding: 16rpx 24rpx;
  border-radius: 999rpx;
  background: #eef1ea;
  color: #232620;
  font-size: 26rpx;
  font-weight: 800;
}

.notice-filter-chip-active {
  background: var(--neo-color-accent);
}

.notice-filter-meta {
  color: #6c7168;
  font-size: 22rpx;
  font-weight: 700;
}

.notice-hero,
.notice-card {
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.notice-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 22rpx;
  padding: 28rpx;
  border-radius: 34rpx;
}

.notice-hero-label {
  display: block;
  font-size: 24rpx;
  color: #72776f;
  font-weight: 700;
}

.notice-hero-value {
  display: block;
  margin-top: 10rpx;
  font-size: 60rpx;
  color: #141512;
  font-weight: 900;
}

.notice-hero-copy {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6d726a;
}

.notice-hero-pill {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: var(--neo-color-accent-soft);
  color: var(--neo-color-accent-deep);
  font-size: 22rpx;
  font-weight: 900;
}

.notice-loaded-content {
  display: block;
}

.notice-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 22rpx;
}

.notice-skeleton-hero,
.notice-skeleton-card,
.notice-skeleton-line,
.notice-skeleton-pill {
  position: relative;
  overflow: hidden;
}

.notice-skeleton-hero::after,
.notice-skeleton-card::after,
.notice-skeleton-line::after,
.notice-skeleton-pill::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.72) 50%, transparent 100%);
  animation: notice-skeleton-shimmer 1.2s ease-in-out infinite;
}

.notice-skeleton-hero,
.notice-skeleton-card {
  border-radius: 30rpx;
  background: #eef2e8;
}

.notice-skeleton-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  min-height: 178rpx;
  padding: 28rpx;
  box-sizing: border-box;
}

.notice-skeleton-card {
  min-height: 176rpx;
  padding: 24rpx;
  box-sizing: border-box;
}

.notice-skeleton-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.notice-skeleton-line {
  height: 24rpx;
  border-radius: 999rpx;
  background: #dde4d5;
}

.notice-skeleton-line + .notice-skeleton-line {
  margin-top: 16rpx;
}

.notice-skeleton-line-label {
  width: 160rpx;
}

.notice-skeleton-line-value {
  width: 92rpx;
  height: 52rpx;
}

.notice-skeleton-line-copy {
  width: 420rpx;
}

.notice-skeleton-line-title {
  width: 360rpx;
  height: 30rpx;
}

.notice-skeleton-line-body {
  width: 100%;
  margin-top: 22rpx;
}

.notice-skeleton-line-body.short {
  width: 62%;
}

.notice-skeleton-pill {
  width: 128rpx;
  height: 52rpx;
  border-radius: 999rpx;
  background: #dde4d5;
  flex-shrink: 0;
}

.notice-skeleton-pill.small {
  width: 96rpx;
  height: 42rpx;
}

.notice-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 20rpx;
}

.notice-card {
  padding: 24rpx;
  border-radius: 30rpx;
}

.notice-card-top,
.notice-card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.notice-card-title {
  flex: 1;
  font-size: 30rpx;
  color: #171814;
  font-weight: 900;
}

.notice-kind-chip {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #eef1ea;
  color: #5f645c;
  font-size: 22rpx;
  font-weight: 800;
}

.notice-kind-chip-unread {
  background: #ffe8eb;
  color: #cf465d;
}

.notice-card-copy {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #60655d;
  line-height: 1.6;
}

.notice-card-bottom {
  margin-top: 18rpx;
}

.notice-card-time,
.notice-card-action {
  font-size: 22rpx;
  font-weight: 700;
}

.notice-card-time {
  color: #787d74;
}

.notice-card-action {
  color: #171814;
}

.notice-empty {
  margin-top: 20rpx;
  padding: 26rpx;
  border-radius: 28rpx;
  background: #ffffff;
  color: #6c7168;
  font-size: 28rpx;
  line-height: 1.6;
}

@keyframes notice-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
