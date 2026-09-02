<script setup lang="ts">
import NeoConfirmDialog from "@/components/neo/NeoConfirmDialog.vue";

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  /** 用户选择队长路线：先完善资料，再引导创建球队。 */
  (event: "select-captain"): void;
  /** 用户选择散人路线：只引导完善头像昵称。 */
  (event: "select-player"): void;
  /** 用户跳过引导（先逛逛 / 关闭弹窗），记录后不再自动弹出。 */
  (event: "skip"): void;
}>();
</script>

<template>
  <NeoConfirmDialog
    :visible="visible"
    title="欢迎来到比赛报名"
    message="完善头像和昵称后，队友才能在报名记录里认出你。你是哪种玩家？"
    primary-text="我是队长，要创建球队"
    secondary-text="我是散人球员"
    :link-items="['先逛逛，下次再说']"
    @primary="emit('select-captain')"
    @secondary="emit('select-player')"
    @link-item="emit('skip')"
    @close="emit('skip')"
  >
    <view class="onboarding-role-picker-options">
      <view class="onboarding-role-option">
        <text class="onboarding-role-option__title">队长</text>
        <text class="onboarding-role-option__desc">创建球队、召集队员、发起报名</text>
      </view>
      <view class="onboarding-role-option">
        <text class="onboarding-role-option__title">散人</text>
        <text class="onboarding-role-option__desc">完善资料，逛约队大厅找球队上车</text>
      </view>
    </view>
  </NeoConfirmDialog>
</template>

<style scoped>
.onboarding-role-picker-options {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 24rpx;
}

.onboarding-role-option {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 18rpx 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  box-sizing: border-box;
}

.onboarding-role-option__title {
  color: var(--neo-color-text);
  font-size: 26rpx;
  font-weight: 900;
  line-height: 1.3;
}

.onboarding-role-option__desc {
  color: var(--neo-color-text-muted);
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.5;
}
</style>
