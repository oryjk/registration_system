<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import NeoSegmentedControl from "@/components/neo/NeoSegmentedControl.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import CaptainThreadsSection from "./components/CaptainThreadsSection.vue";
import { listNotifications, markNotificationRead } from "@/api/notification";
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
    notifications.value = await listNotifications({ limit: 50 });

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
      <text class="notice-title">消息中心</text>
      <text class="notice-subtitle">站内通知与球队留言都在这里，点开详情才算已读。</text>
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
      <view v-if="errorMessage" class="notice-empty">{{ errorMessage }}</view>
      <view v-else-if="showInitialLoadingState" class="notice-skeleton-stack">
        <view v-for="index in 4" :key="index" class="notice-skeleton-card">
          <view class="notice-skeleton-row">
            <view class="notice-skeleton-line notice-skeleton-line-title" />
            <view class="notice-skeleton-pill" />
          </view>
          <view class="notice-skeleton-line notice-skeleton-line-body" />
          <view class="notice-skeleton-line notice-skeleton-line-body short" />
        </view>
      </view>

      <view v-else class="notice-loaded-content">
        <NeoSurface v-if="notificationItems.length" variant="raised" class="notice-hero">
          <view>
            <text class="notice-hero-label">未读提醒</text>
            <text class="notice-hero-value">{{ unreadCount }}</text>
            <text class="notice-hero-copy">点开通知详情后才会标记为已读。</text>
          </view>
        </NeoSurface>

        <view v-if="notificationItems.length" class="notice-list">
          <NeoSurface
            v-for="item in notificationItems"
            :key="item.id"
            variant="raised"
            interactive
            class="notice-card"
            @press="void openNotification(item)"
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
          </NeoSurface>
        </view>
        <view v-else class="notice-empty">当前没有可展示的通知。</view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.notice-page {
  min-height: 100vh;
  padding: 0 28rpx 120rpx;
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.notice-header {
  display: flex;
  flex-direction: column;
}

.notice-title {
  display: block;
  font-size: 48rpx;
  color: var(--neo-color-text);
  font-weight: 900;
}

.notice-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--neo-color-text-muted);
  line-height: 1.5;
  font-weight: 700;
}

.notice-board-segment {
  margin-top: 22rpx;
}

.notice-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 22rpx;
  padding: 28rpx;
}

.notice-hero-label {
  display: block;
  font-size: 24rpx;
  color: var(--neo-color-text-muted);
  font-weight: 800;
}

.notice-hero-value {
  display: block;
  margin-top: 10rpx;
  font-size: 56rpx;
  color: var(--neo-color-text);
  font-weight: 900;
}

.notice-hero-copy {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--neo-color-text-muted);
  font-weight: 700;
}

.notice-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 22rpx;
}

.notice-skeleton-card {
  position: relative;
  overflow: hidden;
  min-height: 168rpx;
  padding: 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-sizing: border-box;
}

.notice-skeleton-card::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.55) 50%, transparent 100%);
  animation: notice-skeleton-shimmer 1.2s ease-in-out infinite;
}

.notice-skeleton-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.notice-skeleton-line {
  height: 24rpx;
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-accent-soft);
}

.notice-skeleton-line + .notice-skeleton-line {
  margin-top: 16rpx;
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
  height: 44rpx;
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-accent-soft);
  flex-shrink: 0;
}

.notice-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 20rpx;
}

.notice-card {
  padding: 24rpx;
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
  color: var(--neo-color-text);
  font-weight: 900;
}

.notice-kind-chip {
  padding: 8rpx 14rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 800;
}

.notice-kind-chip-unread {
  background: var(--neo-color-danger-soft);
  color: var(--neo-color-danger);
}

.notice-card-copy {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  color: var(--neo-color-text-muted);
  font-weight: 700;
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
  color: var(--neo-color-text-muted);
}

.notice-card-action {
  color: var(--neo-color-text);
}

.notice-empty {
  margin-top: 20rpx;
  padding: 26rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text-muted);
  font-size: 28rpx;
  line-height: 1.6;
  font-weight: 700;
}

@keyframes notice-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}

/* #ifdef H5 */
.notice-page {
  width: 100%;
  max-width: 750rpx;
  margin: 0 auto;
}

.notice-page :deep(.app-tab-header-shell) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */
</style>
