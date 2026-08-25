<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import NeoButton from "@/components/neo/NeoButton.vue";
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
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="thread-page" :style="contentStyle">
    <AppTabHeader title="球队留言" showBack />

    <view class="thread-content">
      <view v-if="errorMessage && !thread" class="thread-empty">{{ errorMessage }}</view>
      <view v-else-if="isLoading && !thread" class="thread-empty">正在加载留言...</view>

      <template v-else-if="thread">
        <view class="thread-hero" @tap="openMatch">
          <view class="thread-hero-text">
            <text class="thread-match">{{ thread.match_name }}</text>
            <text class="thread-copy">与 {{ counterpartLabel() }} 的留言往来 · 点击查看比赛</text>
          </view>
        </view>

        <view class="thread-messages">
          <view
            v-for="message in thread.messages"
            :key="message.id"
            :class="['thread-message-row', isOwnMessage(message) ? 'thread-message-own' : 'thread-message-other']"
          >
            <view :class="['thread-bubble', isOwnMessage(message) ? 'thread-bubble-own' : 'thread-bubble-other']">
              <text class="thread-bubble-text">{{ message.content }}</text>
            </view>
            <text class="thread-message-meta">{{ message.sender.nickname }} · {{ formatDateLabel(message.created_at) }}</text>
          </view>
          <view v-if="!thread.messages.length" class="thread-empty">当前串内还没有留言。</view>
        </view>

        <view class="thread-composer">
          <textarea
            class="thread-textarea"
            :value="replyContent"
            placeholder="输入回复..."
            :maxlength="200"
            :disabled="isSubmitting"
            @input="replyContent = ($event as any).detail.value"
          />
          <NeoButton size="sm" :loading="isSubmitting" @click="void submitReply()">
            {{ isSubmitting ? "发送中" : "发送" }}
          </NeoButton>
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped>
.thread-page {
  min-height: 100vh;
  padding: 0 28rpx calc(180rpx + env(safe-area-inset-bottom));
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.thread-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 26rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
}

.thread-match {
  display: block;
  font-size: 32rpx;
  font-weight: 900;
  color: var(--neo-color-text);
}

.thread-copy {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--neo-color-text-muted);
}

.thread-messages {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  margin-top: 22rpx;
}

.thread-message-row {
  display: flex;
  flex-direction: column;
  max-width: 78%;
}

.thread-message-own {
  align-self: flex-end;
  align-items: flex-end;
}

.thread-message-other {
  align-self: flex-start;
  align-items: flex-start;
}

.thread-bubble {
  padding: 20rpx 24rpx;
  border-radius: var(--neo-radius-md);
}

.thread-bubble-own {
  background: var(--neo-color-accent);
  border: var(--neo-border-default);
}

.thread-bubble-other {
  background: var(--neo-color-surface);
  border: var(--neo-border-default);
}

.thread-bubble-text {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--neo-color-text);
  line-height: 1.55;
  word-break: break-all;
}

.thread-message-meta {
  margin-top: 8rpx;
  font-size: 22rpx;
  font-weight: 700;
  color: var(--neo-color-text-muted);
}

.thread-composer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  gap: 16rpx;
  padding: 20rpx 28rpx calc(20rpx + env(safe-area-inset-bottom));
  background: var(--neo-color-surface);
  border-top: var(--neo-border-default);
}

.thread-textarea {
  flex: 1;
  box-sizing: border-box;
  height: 120rpx;
  padding: 18rpx 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-page);
  font-size: 28rpx;
  color: var(--neo-color-text);
}

.thread-empty {
  margin-top: 24rpx;
  padding: 28rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text-muted);
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
</style>
