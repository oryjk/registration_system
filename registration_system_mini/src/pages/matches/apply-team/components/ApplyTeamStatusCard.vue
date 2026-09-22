<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import AppTag from "@/components/ui/AppTag.vue";
import type { AppTeamApplication } from "@/types/match";

defineProps<{
  application: AppTeamApplication;
  isWithdrawing: boolean;
  canWithdraw: boolean;
}>();

const emit = defineEmits<{
  (event: "withdraw"): void;
  (event: "goMatch"): void;
}>();
</script>

<template>
  <AppSurface variant="raised">
    <view class="status-head">
      <text class="status-title">
        {{ application.status === "selected" ? "已被选为对手" : "已提交接约申请" }}
      </text>
      <AppTag :tone="application.status === 'selected' ? 'green' : 'amber'" size="lg">
        {{ application.status === "selected" ? "对手已确认" : "等待对方确认" }}
      </AppTag>
    </view>

    <view class="status-body">
      <text class="status-body-label">我的申请留言</text>
      <text class="status-body-content">{{ application.introduction }}</text>
    </view>

    <view v-if="application.status === 'pending' && !canWithdraw" class="status-window-note">
      当前不在报名时间内，申请不可撤回。
    </view>
    <view v-if="application.status === 'pending' && canWithdraw" class="status-actions">
      <AppButton
        variant="outline"
        :loading="isWithdrawing"
        @click="emit('withdraw')"
      >
        {{ isWithdrawing ? "撤回中..." : "撤回申请" }}
      </AppButton>
    </view>
    <view v-else-if="application.status === 'selected'" class="status-actions">
      <AppButton variant="dark" @click="emit('goMatch')">去报名出场</AppButton>
    </view>
  </AppSurface>
</template>

<style scoped>
.status-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.status-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--ui-color-text);
}

.status-body {
  margin-top: 20rpx;
  padding: 18rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-muted);
}

.status-body-label {
  display: block;
  font-size: 22rpx;
  font-weight: 400;
  color: var(--ui-color-text-muted);
}

.status-body-content {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  line-height: 1.6;
  font-weight: 600;
  color: var(--ui-color-text);
}

.status-actions {
  display: flex;
  justify-content: center;
  margin-top: 26rpx;
}

.status-window-note {
  margin-top: 22rpx;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  line-height: 1.5;
  text-align: center;
}

.status-actions :deep(.ui-button) {
  min-width: 260rpx;
}
</style>
