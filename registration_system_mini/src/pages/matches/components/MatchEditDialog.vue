<script setup lang="ts">
import NeoConfirmDialog from "@/components/neo/NeoConfirmDialog.vue";

defineProps<{
  visible: boolean;
  opponentName: string;
  maxPlayers: string;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "update:opponentName", value: string): void;
  (event: "update:maxPlayers", value: string): void;
  (event: "submit"): void;
}>();
</script>

<template>
  <!-- 修改比赛：当前仅开放对手名称与报名人数上限（借对话框默认插槽承载轻量表单）。 -->
  <NeoConfirmDialog
    :visible="visible"
    title="修改比赛"
    message="目前支持修改对手名称与报名人数上限。"
    primary-text="保存修改"
    secondary-text="取消"
    :loading="submitting"
    :primary-disabled="submitting || !maxPlayers.trim() || Number(maxPlayers) <= 0"
    @primary="emit('submit')"
    @secondary="emit('close')"
    @close="emit('close')"
  >
    <view class="match-edit-field">
      <text class="match-edit-label">对手名称</text>
      <input
        class="match-edit-input"
        :value="opponentName"
        placeholder="输入对手球队名称（留空表示清除）"
        :disabled="submitting"
        @input="emit('update:opponentName', ($event as any).detail.value)"
      />
    </view>
    <view class="match-edit-field">
      <text class="match-edit-label">报名人数上限</text>
      <input
        class="match-edit-input"
        type="number"
        :value="maxPlayers"
        placeholder="本队报名组的人数上限"
        :disabled="submitting"
        @input="emit('update:maxPlayers', ($event as any).detail.value)"
      />
    </view>
  </NeoConfirmDialog>
</template>

<style scoped>
.match-edit-field {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 18rpx;
}

.match-edit-label {
  font-size: 25rpx;
  font-weight: 800;
  color: var(--neo-color-text-muted);
}

.match-edit-input {
  box-sizing: border-box;
  width: 100%;
  height: 84rpx;
  padding: 0 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-page);
  font-size: 28rpx;
  color: var(--neo-color-text);
}
</style>
