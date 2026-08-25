<script setup lang="ts">
import { computed } from "vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import type { AppMatchCaptain } from "@/types/match";

const props = defineProps<{
  captain: AppMatchCaptain;
  matchId: string;
  popupVisible: boolean;
  content: string;
  isSubmitting: boolean;
}>();

const emit = defineEmits<{
  (event: "open"): void;
  (event: "close"): void;
  (event: "update:content", value: string): void;
  (event: "submit"): void;
}>();

const visible = computed({
  get: () => props.popupVisible,
  set: (value: boolean) => {
    if (!value) emit("close");
  },
});

</script>

<template>
  <NeoSurface variant="raised" class="captain-card">
    <view class="captain-info">
      <image
        class="captain-avatar"
        :src="captain.avatar_url || '/static/tab-png/user.png'"
        mode="aspectFill"
      />
      <view class="captain-text">
        <text class="captain-name">{{ captain.nickname || `队长 ${captain.user_id}` }}</text>
        <text class="captain-copy">想加入这场比赛？给主队队长留言沟通。</text>
      </view>
    </view>
    <NeoButton size="sm" @click="emit('open')">联系队长</NeoButton>

    <wd-popup
      v-model="visible"
      position="bottom"
      custom-class="captain-message-popup"
      :close-on-click-modal="!isSubmitting"
      :z-index="50"
      safe-area-inset-bottom
      root-portal
      @close="emit('close')"
    >
      <view class="captain-sheet">
        <view class="captain-sheet-header">
          <view>
            <text class="captain-sheet-kicker">给 {{ captain.nickname || "队长" }} 留言</text>
            <text class="captain-sheet-copy">对方会在消息中心收到提醒并可回复你。</text>
          </view>
        </view>
        <view class="captain-sheet-field">
          <textarea
            class="captain-textarea"
            :value="content"
            placeholder="介绍一下自己：位置、水平、想约的时间等"
            :maxlength="200"
            :disabled="isSubmitting"
            @input="emit('update:content', ($event as any).detail.value)"
          />
          <text class="captain-counter">{{ content.length }}/200</text>
        </view>
        <NeoButton block :loading="isSubmitting" @click="emit('submit')">
          {{ isSubmitting ? "发送中..." : "发送留言" }}
        </NeoButton>
      </view>
    </wd-popup>
  </NeoSurface>
</template>

<style scoped>
.captain-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.captain-info {
  display: flex;
  align-items: center;
  gap: 18rpx;
  flex: 1;
  min-width: 0;
}

.captain-avatar {
  width: 84rpx;
  height: 84rpx;
  border-radius: 50%;
  border: var(--neo-border-default);
  flex-shrink: 0;
  background: var(--neo-color-surface);
}

.captain-text {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.captain-name {
  font-size: 28rpx;
  font-weight: 900;
  color: var(--neo-color-text);
}

.captain-copy {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--neo-color-text-muted);
  line-height: 1.5;
}

.captain-sheet {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 32rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
  background: var(--neo-color-surface);
  border-radius: 32rpx 32rpx 0 0;
}

.captain-sheet-kicker {
  display: block;
  font-size: 32rpx;
  font-weight: 900;
  color: var(--neo-color-text);
}

.captain-sheet-copy {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--neo-color-text-muted);
}

.captain-sheet-field {
  position: relative;
}

.captain-textarea {
  box-sizing: border-box;
  width: 100%;
  height: 220rpx;
  padding: 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-page);
  font-size: 28rpx;
  color: var(--neo-color-text);
}

.captain-counter {
  position: absolute;
  right: 20rpx;
  bottom: 16rpx;
  font-size: 22rpx;
  font-weight: 700;
  color: var(--neo-color-text-muted);
}
</style>
