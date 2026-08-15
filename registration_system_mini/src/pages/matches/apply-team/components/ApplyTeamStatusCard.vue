<script setup lang="ts">
import { NeoButton, NeoSurface, NeoTag } from "@/components/neo";
import type { AppTeamApplication } from "@/types/match";

defineProps<{
  application: AppTeamApplication;
  isWithdrawing: boolean;
}>();

const emit = defineEmits<{
  (event: "withdraw"): void;
  (event: "goMatch"): void;
}>();
</script>

<template>
  <NeoSurface variant="raised">
    <view class="status-head">
      <text class="status-title">
        {{ application.status === "selected" ? "已被选为对手" : "已提交接约申请" }}
      </text>
      <NeoTag :tone="application.status === 'selected' ? 'green' : 'amber'" size="lg">
        {{ application.status === "selected" ? "对手已确认" : "等待对方确认" }}
      </NeoTag>
    </view>

    <view class="status-body">
      <text class="status-body-label">我的申请留言</text>
      <text class="status-body-content">{{ application.introduction }}</text>
    </view>

    <view v-if="application.status === 'pending'" class="status-actions">
      <NeoButton
        variant="outline"
        :loading="isWithdrawing"
        @click="emit('withdraw')"
      >
        {{ isWithdrawing ? "撤回中..." : "撤回申请" }}
      </NeoButton>
    </view>
    <view v-else-if="application.status === 'selected'" class="status-actions">
      <NeoButton variant="dark" @click="emit('goMatch')">去报名出场</NeoButton>
    </view>
  </NeoSurface>
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
  font-weight: 900;
  color: var(--neo-color-text);
}

.status-body {
  margin-top: 20rpx;
  padding: 18rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
}

.status-body-label {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: var(--neo-color-text-muted);
}

.status-body-content {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  line-height: 1.6;
  font-weight: 600;
  color: var(--neo-color-text);
}

.status-actions {
  display: flex;
  justify-content: center;
  margin-top: 26rpx;
}

.status-actions :deep(.neo-button) {
  min-width: 260rpx;
}
</style>
