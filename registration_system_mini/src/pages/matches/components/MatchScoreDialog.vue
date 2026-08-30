<script setup lang="ts">
import NeoConfirmDialog from "@/components/neo/NeoConfirmDialog.vue";

defineProps<{
  visible: boolean;
  hostTeamLabel: string;
  awayTeamLabel: string;
  hostScore: string;
  awayScore: string;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "update:hostScore", value: string): void;
  (event: "update:awayScore", value: string): void;
  (event: "submit"): void;
}>();

function isValidScore(value: string): boolean {
  return /^\d{1,3}$/.test(value.trim());
}
</script>

<template>
  <!-- 录入比分：主/客两个数字输入（0 是合法比分，空视为无效，提交前校验）。 -->
  <NeoConfirmDialog
    :visible="visible"
    title="录入比分"
    message="比赛进行中与结束后均可录入，重复提交会覆盖此前的比分。"
    primary-text="保存比分"
    secondary-text="取消"
    :loading="submitting"
    :primary-disabled="submitting || !isValidScore(hostScore) || !isValidScore(awayScore)"
    @primary="emit('submit')"
    @secondary="emit('close')"
    @close="emit('close')"
  >
    <view class="score-field-row">
      <view class="score-field">
        <text class="score-field-label">{{ hostTeamLabel }}</text>
        <input
          class="score-field-input"
          type="number"
          :value="hostScore"
          placeholder="0"
          :disabled="submitting"
          @input="emit('update:hostScore', ($event as any).detail.value)"
        />
      </view>
      <text class="score-field-separator">:</text>
      <view class="score-field">
        <text class="score-field-label">{{ awayTeamLabel }}</text>
        <input
          class="score-field-input"
          type="number"
          :value="awayScore"
          placeholder="0"
          :disabled="submitting"
          @input="emit('update:awayScore', ($event as any).detail.value)"
        />
      </view>
    </view>
  </NeoConfirmDialog>
</template>

<style scoped>
.score-field-row {
  display: flex;
  align-items: flex-end;
  gap: 20rpx;
  margin-top: 18rpx;
}

.score-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
}

.score-field-label {
  font-size: 25rpx;
  font-weight: 800;
  color: var(--neo-color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-field-input {
  box-sizing: border-box;
  width: 100%;
  height: 84rpx;
  padding: 0 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-page);
  font-size: 32rpx;
  font-weight: 900;
  text-align: center;
  color: var(--neo-color-text);
}

.score-field-separator {
  font-size: 40rpx;
  font-weight: 900;
  color: var(--neo-color-text-muted);
  padding-bottom: 20rpx;
}
</style>
