<script setup lang="ts">
import type { AvatarItem } from "@/components/ui/avatarTypes";
import { computed } from "vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import type { AppMatchCaptain } from "@/types/match";

const props = defineProps<{
  captain: AppMatchCaptain;
  embedded?: boolean;
  matchId: string;
  popupVisible: boolean;
  content: string;
  isSubmitting: boolean;
}>();

const emit = defineEmits<{
  (event: "avatarSelect", avatar: AvatarItem): void;
  (event: "open"): void;
  (event: "close"): void;
  (event: "update:content", value: string): void;
  (event: "submit"): void;
}>();

const captainName = computed(() => props.captain.nickname || "队长");

</script>

<template>
  <view :class="['captain-surface', embedded ? 'captain-surface--embedded' : '']">
    <view class="captain-card">
    <view class="captain-info">
      <image
        class="captain-avatar"
        @tap="emit('avatarSelect', { id: captain.user_id, name: captainName, avatarUrl: captain.avatar_url || undefined })"
        :src="captain.avatar_url || '/static/tab-png/user.png'"
        mode="aspectFill"
      />
      <view class="captain-text">
        <text class="captain-name">{{ captain.nickname || `队长 ${captain.user_id}` }}</text>

      </view>
    </view>
    <button class="captain-contact-button" hover-class="captain-contact-button--pressed" @tap="emit('open')">联系队长</button>

    </view>
    <ConfirmDialog
      :visible="popupVisible"
      :title="`给 ${captainName} 留言`"
      message="对方会在消息中心收到提醒并可回复你。"
      primary-text="发送留言"
      secondary-text=""
      :loading="isSubmitting"
      @primary="emit('submit')"
      @close="emit('close')"
    >
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
    </ConfirmDialog>
  </view>
</template>

<style scoped>
.captain-surface { border: var(--ui-border-default); border-radius: var(--ui-radius-card); background: var(--ui-color-surface); }
.captain-surface--embedded { margin-top: 24rpx; border: 0; border-top: var(--ui-border-default); border-radius: 0; }
.captain-surface--embedded .captain-card { padding: 20rpx 0 0; }

.captain-contact-button { margin: 0; padding: 12rpx 22rpx; border: 0; border-radius: var(--ui-radius-round); background: var(--ui-color-accent-soft); color: var(--ui-color-text); font-size: 24rpx; font-weight: 600; line-height: 1.4; flex-shrink: 0; }
.captain-contact-button::after { border: 0; }
.captain-contact-button--pressed { box-shadow: var(--ui-shadow-control-pressed); }

.captain-card {
  padding: 20rpx 24rpx;
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
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  border: 0;
  flex-shrink: 0;
  background: var(--ui-color-surface);
}

.captain-text {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.captain-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ui-color-text);
}

.captain-copy {
  font-size: 24rpx;
  font-weight: 400;
  color: var(--ui-color-text-muted);
  line-height: 1.5;
}

.captain-sheet-field {
  position: relative;
  margin-top: 26rpx;
}

.captain-textarea {
  box-sizing: border-box;
  width: 100%;
  height: 220rpx;
  padding: 22rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-page);
  font-size: 28rpx;
  color: var(--ui-color-text);
}

.captain-counter {
  position: absolute;
  right: 20rpx;
  bottom: 16rpx;
  font-size: 22rpx;
  font-weight: 400;
  color: var(--ui-color-text-muted);
}

/* #ifdef MP-WEIXIN */
.captain-surface { border: var(--ui-panel-border); border-radius: var(--ui-content-surface-radius, var(--ui-card-radius)); box-shadow: var(--ui-content-surface-shadow, var(--ui-card-shadow)); }
.captain-surface--embedded { border-top: var(--ui-list-divider); border-radius: var(--ui-panel-radius); box-shadow: var(--ui-panel-shadow); margin-top: var(--ui-space-6); }
.captain-card { padding: var(--ui-space-5) var(--ui-panel-padding); gap: var(--ui-space-5); }
.captain-surface--embedded .captain-card { padding: var(--ui-space-5) 0 0; }
.captain-contact-button { display: flex; align-items: center; justify-content: center; box-sizing: border-box; text-align: center; background: var(--ui-color-cta); color: var(--ui-color-cta-fg); min-height: var(--ui-control-min-height); padding: var(--ui-space-3) var(--ui-space-5); font-weight: var(--ui-font-weight-heading); }
.captain-textarea { border: var(--ui-input-border); border-radius: var(--ui-input-radius); padding: var(--ui-input-padding); font-size: var(--ui-text-label); background: var(--ui-color-surface); }
/* #endif */
</style>
