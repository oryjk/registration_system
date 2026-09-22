<script setup lang="ts">
import { usePageRefresh } from "@/composables/usePageRefresh";
import { useAccentTheme } from "@/stores/theme";
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import RunningLoader from "@/components/ui/RunningLoader.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
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

// 分段标签带各自未读数：统一用 store 的服务端口径（进页 sync 即拉取），
// 不依赖当前板块是否已加载列表，避免「切过去才出现角标」。
const boardOptions = computed(() => [
  { label: notificationUnreadCount.value > 0 ? `通知 ${notificationUnreadCount.value}` : "通知", value: "notifications" },
  { label: captainUnreadCount.value > 0 ? `留言 ${captainUnreadCount.value}` : "留言", value: "captainMessages" },
]);
const activeBoardTab = ref<NoticeBoardTab>("notifications");

const { currentUser } = useAppSession();
const { notificationUnreadCount, captainUnreadCount } = useNotificationCenter();
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

    // 已读完全由用户点击通知驱动：进页不再自动清红点，角标同步真实未读数。
    await syncUnreadCount({ skipEnsure: true });
    hasLoadedOnce.value = true;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "通知加载失败";
  } finally {
    isLoading.value = false;
  }
}

async function openNotification(item: { id: number; relatedPath: string; read: boolean }) {
  // 点击通知才算已读；无详情链接的历史通知同样可读，标记失败不阻断有效详情跳转。
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
  if (item.relatedPath) uni.navigateTo({ url: item.relatedPath });
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
usePageRefresh(async () => {
  await Promise.all([loadNotifications(), ...(activeBoardTab.value === 'captainMessages' ? [captainThreads.loadPage()] : [])]);
});
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope notice-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader title="消息中心" showBack />

    <SegmentedControl
      :model-value="activeBoardTab"
      :options="boardOptions"
      class="notice-board-segment"
      @update:model-value="handleBoardTabChange"
    />

    <!-- key 绑定分区：仅通知/队长留言切换时重播轻淡入；已读、分页加载不重播。 -->
    <view :key="activeBoardTab" class="notice-board-content">
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
      <RunningLoader v-else-if="showInitialLoadingState" text="正在收取战报" />

      <view v-else class="notice-loaded-content">
        <view v-if="notificationItems.length" class="notice-summary"><text>未读 {{ unreadCount }} 条</text><text>点击通知标记已读</text></view>

        <view v-if="notificationItems.length" class="notice-list">
          <AppSurface
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
              <text class="notice-card-action">{{ item.relatedPath ? "查看详情" : item.read ? "已读" : "标为已读" }}</text>
            </view>
          </AppSurface>
        </view>
        <view v-else class="notice-empty">当前没有可展示的通知。</view>
      </view>
    </template>
    </view>
  </view>
</template>

<style scoped>
.notice-page {
  min-height: 100vh;
  padding: 0 28rpx 120rpx;
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.notice-board-content {
  animation: notice-content-fade-in var(--ui-motion-switch-duration) var(--ui-motion-ease-out);
}

@keyframes notice-content-fade-in {
  from {
    opacity: 0;
    transform: translateY(6rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* H5 减少动态效果：列表直接切换。 */
@media (prefers-reduced-motion: reduce) {
  .notice-board-content {
    animation: none;
  }
}

.notice-board-segment {
  margin-top: 22rpx;
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
  color: var(--ui-color-text);
  font-weight: 600;
}

.notice-kind-chip {
  padding: 8rpx 14rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  font-weight: 500;
}

.notice-kind-chip-unread {
  background: var(--ui-color-danger-soft);
  color: var(--ui-color-danger);
}

.notice-card-copy {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  color: var(--ui-color-text-muted);
  font-weight: 400;
  line-height: 1.6;
}

.notice-card-bottom {
  margin-top: 18rpx;
}

.notice-card-time,
.notice-card-action {
  font-size: 22rpx;
  font-weight: 400;
}

.notice-card-time {
  color: var(--ui-color-text-muted);
}

.notice-card-action {
  color: var(--ui-color-text);
}

.notice-empty {
  margin-top: 20rpx;
  padding: 26rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text-muted);
  font-size: 28rpx;
  line-height: 1.6;
  font-weight: 400;
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
.notice-summary { display: flex; justify-content: space-between; gap: 12rpx; margin: 22rpx 4rpx 0; font-size: 22rpx; color: var(--ui-color-text-muted); }
</style>
