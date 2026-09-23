<script setup lang="ts">
import { usePageRefresh } from "@/composables/usePageRefresh";
import { useAccentTheme } from "@/stores/theme";
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import RunningLoader from "@/components/ui/RunningLoader.vue";
import { getCaptainThread, replyCaptainMessage } from "@/api/captainMessage";
import type { AppCaptainMessageItem, AppCaptainThreadDetail } from "@/types/captainMessage";
import { formatDateLabel } from "@/utils/datetime";
import { getCustomNavMetrics } from "@/utils/customNav";

const { themePageStyle } = useAccentTheme();

const navMetrics = getCustomNavMetrics();
const threadId = ref("");
const isLoading = ref(false);
const errorMessage = ref("");
const thread = ref<AppCaptainThreadDetail | null>(null);
const replyContent = ref("");
const isSubmitting = ref(false);

const contentStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

/** 气泡归属：查看者是发起人时队长侧在左；查看者是队长侧时发起人在左。 */
function isOwnMessage(message: AppCaptainMessageItem): boolean {
  if (!thread.value) return false;
  return thread.value.viewer_is_manager ? message.sender_is_captain_side : !message.sender_is_captain_side;
}

function counterpartLabel(): string {
  if (!thread.value) return "";
  if (thread.value.viewer_is_manager) {
    const ownerMessage = thread.value.messages.find((message) => !message.sender_is_captain_side);
    return ownerMessage?.sender.nickname || "留言用户";
  }
  return `${thread.value.host_team_name} · 队长`;
}

async function loadThread() {
  if (!threadId.value) return;
  isLoading.value = true;
  errorMessage.value = "";
  try {
    thread.value = await getCaptainThread(threadId.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "留言加载失败";
  } finally {
    isLoading.value = false;
  }
}

async function submitReply() {
  const trimmed = replyContent.value.trim();
  if (!trimmed) {
    uni.showToast({ title: "回复内容不能为空", icon: "none" });
    return;
  }
  if (isSubmitting.value || !threadId.value) return;
  isSubmitting.value = true;
  try {
    await replyCaptainMessage(threadId.value, trimmed);
    replyContent.value = "";
    await loadThread();
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "回复发送失败", icon: "none" });
  } finally {
    isSubmitting.value = false;
  }
}

function openMatch() {
  if (!thread.value?.match_id) return;
  uni.navigateTo({ url: `/pages/matches/detail?id=${thread.value.match_id}` });
}


onLoad((options) => {
  threadId.value = options?.id || "";
});

onShow(() => {
  void loadThread();
});
usePageRefresh(loadThread);
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope thread-page" :style="[themePageStyle, contentStyle]">
    <AppTabHeader title="球队留言" showBack />

    <view class="thread-content">
      <view v-if="errorMessage && !thread" class="thread-empty">{{ errorMessage }}</view>
      <RunningLoader v-else-if="isLoading && !thread" text="正在收取留言" />

      <template v-else-if="thread">
        <view class="thread-hero" hover-class="thread-hero--pressed" role="button" @tap="openMatch">
          <text class="thread-hero-label">关联比赛</text>
          <view class="thread-hero-main">
            <text class="thread-match">{{ thread.match_name }}</text>
            <text class="thread-hero-link">查看比赛 ›</text>
          </view>
          <text class="thread-copy">与 {{ counterpartLabel() }} 的留言往来</text>
        </view>

        <view class="thread-section-heading">
          <text class="thread-section-title">留言记录</text>
          <text class="thread-section-count">共 {{ thread.messages.length }} 条</text>
        </view>

        <view class="thread-messages">
          <view
            v-for="message in thread.messages"
            :key="message.id"
            :class="['thread-message-row', isOwnMessage(message) ? 'thread-message-own' : 'thread-message-other']"
          >
            <view class="thread-message-body">
              <image
                v-if="message.sender.avatar_url"
                class="thread-avatar"
                :src="message.sender.avatar_url"
                mode="aspectFill"
              />
              <view v-else class="thread-avatar thread-avatar-fallback">{{ message.sender.nickname.slice(0, 1) || "球" }}</view>
              <view :class="['thread-bubble', isOwnMessage(message) ? 'thread-bubble-own' : 'thread-bubble-other']">
                <text class="thread-bubble-text">{{ message.content }}</text>
              </view>
            </view>
            <text class="thread-message-meta">{{ message.sender.nickname }} · {{ formatDateLabel(message.created_at) }}</text>
          </view>
          <view v-if="!thread.messages.length" class="thread-empty">当前串内还没有留言。</view>
        </view>

        <view class="thread-composer">
          <view class="thread-composer-inner">
            <view class="thread-composer-row">
              <view class="thread-input-shell">
                <textarea
                  class="thread-textarea"
                  :value="replyContent"
                  placeholder="回复对方，聊聊比赛安排…"
                  :maxlength="200"
                  :disabled="isSubmitting"
                  @input="replyContent = ($event as any).detail.value"
                />
                <text class="thread-composer-count">{{ replyContent.length }}/200</text>
              </view>
              <view class="thread-send-action">
                <AppButton
                  :variant="replyContent.trim() ? 'lime' : 'muted'"
                  block
                  :loading="isSubmitting"
                  :disabled="!replyContent.trim()"
                  @click="void submitReply()"
                >发送</AppButton>
              </view>
            </view>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped>
.thread-page {
  min-height: 100vh;
  padding: 0 28rpx calc(198rpx + env(safe-area-inset-bottom));
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.thread-content {
  display: flex;
  flex-direction: column;
}

.thread-hero {
  padding: 24rpx 26rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-card);
  transition: transform var(--ui-motion-press-duration) var(--ui-motion-ease-out), opacity var(--ui-motion-press-duration) ease;
}

.thread-hero--pressed {
  transform: scale(0.99);
  opacity: 0.88;
}

.thread-hero-label {
  display: block;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  line-height: 1.4;
}

.thread-hero-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 8rpx;
}

.thread-match {
  display: block;
  min-width: 0;
  flex: 1;
  font-size: 32rpx;
  font-weight: var(--ui-font-weight-heading);
  color: var(--ui-color-text);
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.thread-hero-link {
  flex-shrink: 0;
  color: var(--ui-color-text);
  font-size: 24rpx;
  font-weight: 600;
}

.thread-copy {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  font-weight: 400;
  color: var(--ui-color-text-muted);
  line-height: 1.5;
}

.thread-section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 32rpx;
  gap: 16rpx;
}

.thread-section-title {
  color: var(--ui-color-text);
  font-size: 30rpx;
  font-weight: var(--ui-font-weight-heading);
}

.thread-section-count {
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
}

.thread-messages {
  display: flex;
  flex-direction: column;
  gap: 26rpx;
  margin-top: 24rpx;
}

.thread-message-row {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.thread-message-body {
  display: flex;
  align-items: flex-end;
  gap: 12rpx;
  max-width: 88%;
}

.thread-message-own {
  align-items: flex-end;
}

.thread-message-own .thread-message-body {
  flex-direction: row-reverse;
}

.thread-message-other {
  align-items: flex-start;
}

.thread-avatar {
  width: 52rpx;
  height: 52rpx;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--ui-color-neutral-bg);
}

.thread-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ui-color-text);
  font-size: 22rpx;
  font-weight: 600;
}

.thread-bubble {
  min-width: 0;
  max-width: calc(100% - 64rpx);
  padding: 20rpx 24rpx;
  border-radius: 26rpx;
  box-sizing: border-box;
}

.thread-bubble-own {
  background: var(--ui-color-accent-soft);
  border-bottom-right-radius: 8rpx;
}

.thread-bubble-other {
  background: var(--ui-color-surface);
  border: var(--ui-border-default);
  border-bottom-left-radius: 8rpx;
}

.thread-bubble-text {
  font-size: 28rpx;
  font-weight: 400;
  color: var(--ui-color-text);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.thread-message-meta {
  margin-top: 8rpx;
  margin-left: 64rpx;
  font-size: 22rpx;
  font-weight: 400;
  color: var(--ui-color-text-muted);
}

.thread-message-own .thread-message-meta {
  margin-left: 0;
  margin-right: 64rpx;
}

.thread-composer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  padding: 18rpx 28rpx calc(20rpx + env(safe-area-inset-bottom));
  background: var(--ui-color-surface);
  border-top: var(--ui-border-default);
  box-shadow: var(--ui-shadow-soft);
  box-sizing: border-box;
}

.thread-composer-inner {
  width: 100%;
}

.thread-composer-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.thread-input-shell {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 120rpx;
  box-sizing: border-box;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-neutral-bg);
}

.thread-textarea {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 18rpx 20rpx 38rpx;
  border: 0;
  background: transparent;
  font-size: 28rpx;
  color: var(--ui-color-text);
  line-height: 1.5;
}

.thread-composer-count {
  position: absolute;
  right: 18rpx;
  bottom: 10rpx;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  line-height: 1.2;
}

.thread-send-action {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 154rpx;
  flex-shrink: 0;
}

.thread-empty {
  margin-top: 24rpx;
  padding: 28rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text-muted);
  font-size: 28rpx;
  line-height: 1.6;
}

/* #ifdef H5 */
.thread-page {
  width: 100%;
  max-width: 750rpx;
  margin: 0 auto;
}

.thread-page :deep(.app-tab-header-shell) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}

.thread-composer {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */

@media (prefers-reduced-motion: reduce) {
  .thread-hero {
    transition: none;
  }

  .thread-hero--pressed {
    transform: none;
  }
}
</style>
