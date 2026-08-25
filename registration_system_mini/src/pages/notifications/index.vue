<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import NeoSegmentedControl from "@/components/neo/NeoSegmentedControl.vue";
import CaptainThreadsSection from "./components/CaptainThreadsSection.vue";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/api/notification";
import { setCaptainUnreadCount, setUnreadCount, syncUnreadCount, useNotificationCenter } from "@/stores/notificationCenter";
import { ensureSessionReady, useAppSession } from "@/stores/appSession";
import type { BackendNotification } from "@/types/backend";
import { getCustomNavMetrics } from "@/utils/customNav";
import { buildNotificationItems } from "@/utils/viewModels";
import { useCaptainThreads } from "./useCaptainThreads";

const { themePageStyle } = useAccentTheme();

const navMetrics = getCustomNavMetrics();
const isLoading = ref(false);
const hasLoadedOnce = ref(false);
const errorMessage = ref("");
const unreadOnly = ref(false);
const notifications = ref<BackendNotification[]>([]);

type NoticeBoardTab = "notifications" | "captainMessages";

// 分段标签带各自未读数：通知用本地列表统计，留言用对话列表汇总（服务端口径）。
const boardOptions = computed(() => [
  { label: unreadCount.value > 0 ? `通知 ${unreadCount.value}` : "通知", value: "notifications" },
  { label: captainThreads.unreadTotal.value > 0 ? `留言 ${captainThreads.unreadTotal.value}` : "留言", value: "captainMessages" },
]);
const activeBoardTab = ref<NoticeBoardTab>("notifications");

const { currentUser } = useAppSession();
const { notificationUnreadCount } = useNotificationCenter();
const myUserId = computed(() => currentUser.value?.id ?? null);
const captainThreads = useCaptainThreads(myUserId);

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

    // 已读完全由用户点开详情驱动：进页不再自动清红点，角标同步真实未读数。
    await syncUnreadCount({ skipEnsure: true });
    hasLoadedOnce.value = true;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "通知加载失败";
  } finally {
    isLoading.value = false;
  }
}

async function openNotification(item: { id: number; relatedPath: string; read: boolean }) {
  if (!item.relatedPath) return;
  // 点开详情才算已读；标记失败不阻断跳转。
  if (!item.read) {
    try {
      await markNotificationRead(item.id);
      notifications.value = notifications.value.map((notification) => (
        notification.id === item.id
          ? { ...notification, read_at: notification.read_at ?? new Date().toISOString() }
          : notification
      ));
      setUnreadCount(Math.max(notificationUnreadCount.value - 1, 0));
      void syncUnreadCount({ skipEnsure: true }).catch(() => {});
    } catch {
      // 已读标记失败时仍进入详情，下次进列表重新拉取真实状态。
    }
  }
  uni.navigateTo({ url: item.relatedPath });
}

async function handleMarkAllRead() {
  try {
    await markAllNotificationsRead();
    notifications.value = notifications.value.map((item) => ({
      ...item,
      read_at: item.read_at ?? new Date().toISOString(),
    }));
    setUnreadCount(0);
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
  }
}

function openCaptainThread(threadId: string) {
  const thread = captainThreads.items.value.find((item) => item.id === threadId);
  uni.navigateTo({
    url: `/pages/messages/thread/index?id=${threadId}`,
    complete: () => {
      // 打开即视为已读：本地清该串未读，返回后 sync 再与服务端对齐。
      setCaptainUnreadCount(Math.max(captainThreads.unreadTotal.value - (thread?.unread ?? 0), 0));
    },
  });
}

function handleBoardTabChange(value: string) {
  const next: NoticeBoardTab = value === "captainMessages" ? "captainMessages" : "notifications";
  activeBoardTab.value = next;
  if (next === "captainMessages" && !captainThreads.hasLoadedOnce.value) {
    void captainThreads.loadPage();
  }
}

onShow(() => {
  void loadNotifications();
  if (activeBoardTab.value === "captainMessages") {
    void captainThreads.loadPage();
  }
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

    <NeoSegmentedControl
      :model-value="activeBoardTab"
      :options="boardOptions"
      class="notice-board-segment"
      @update:model-value="handleBoardTabChange"
    />

    <template v-if="activeBoardTab === 'captainMessages'">
      <CaptainThreadsSection
        :items="captainThreads.items.value"
        :is-loading="captainThreads.isLoading.value"
        :is-loading-more="captainThreads.isLoadingMore.value"
        :has-loaded-once="captainThreads.hasLoadedOnce.value"
        :error-message="captainThreads.errorMessage.value"
        :has-more="captainThreads.hasMore.value"
        @open="openCaptainThread"
        @retry="void captainThreads.loadPage()"
        @load-more="void captainThreads.loadMore()"
      />
    </template>

    <template v-else>
    <view class="notice-filter-row">
      <view :class="['notice-filter-chip', !unreadOnly ? 'notice-filter-chip-active' : '']" @tap="unreadOnly = false; void loadNotifications()">全部</view>
      <view :class="['notice-filter-chip', unreadOnly ? 'notice-filter-chip-active' : '']" @tap="unreadOnly = true; void loadNotifications()">仅看未读</view>
      <view class="notice-filter-chip" @tap="void handleMarkAllRead()">全部已读</view>
      <view class="notice-filter-meta">点开详情才算已读</view>
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
          <text class="notice-hero-copy">点开通知详情后才会标记为已读。</text>
        </view>
        <view class="notice-hero-pill">站内消息</view>
      </view>

      <view v-if="notificationItems.length" class="notice-list">
        <view
          v-for="item in notificationItems"
          :key="item.id"
          class="notice-card"
          @tap="void openNotification(item)"
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
    </template>
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

.notice-board-segment {
  margin-top: 22rpx;
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
