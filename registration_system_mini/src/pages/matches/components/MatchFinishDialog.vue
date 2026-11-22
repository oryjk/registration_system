<script setup lang="ts">
import { computed } from "vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import { parseOptionalFinishScore } from "../useMatchFinish";

const props = defineProps<{
  visible: boolean;
  hostTeamLabel: string;
  awayTeamLabel: string;
  hostScore: string;
  awayScore: string;
  canCancel: boolean;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "update:hostScore", value: string): void;
  (event: "update:awayScore", value: string): void;
  (event: "finish"): void;
  (event: "cancelMatch"): void;
}>();

const scoreCheck = computed(() => parseOptionalFinishScore(props.hostScore, props.awayScore));
</script>

<template>
  <!-- 结束比赛：支持选填双方比分（双方都留空即可直接结束）；遮罩/× 只关闭不改动状态。 -->
  <ConfirmDialog
    :visible="visible"
    title="结束比赛"
    message="比赛时间已过，可顺便填写最终比分（选填，不填也可直接结束）。"
    primary-text="比赛结束"
    :secondary-text="canCancel ? '比赛取消' : ''"
    :loading="submitting"
    :primary-disabled="submitting || !scoreCheck.valid"
    @primary="emit('finish')"
    @secondary="emit('cancelMatch')"
    @close="emit('close')"
  >
    <view class="finish-score-block">
      <view class="finish-score-row">
        <view class="finish-score-field">
          <text class="finish-score-label">{{ hostTeamLabel }}</text>
          <input
            class="finish-score-input"
            type="number"
            :value="hostScore"
            placeholder="选填"
            :disabled="submitting"
            @input="emit('update:hostScore', ($event as any).detail.value)"
          />
        </view>
        <text class="finish-score-separator">:</text>
        <view class="finish-score-field">
          <text class="finish-score-label">{{ awayTeamLabel }}</text>
          <input
            class="finish-score-input"
            type="number"
            :value="awayScore"
            placeholder="选填"
            :disabled="submitting"
            @input="emit('update:awayScore', ($event as any).detail.value)"
          />
        </view>
      </view>
      <text v-if="scoreCheck.error" class="finish-score-error">{{ scoreCheck.error }}</text>
    </view>
  </ConfirmDialog>
</template>

<style scoped>
.finish-score-block {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  margin-top: var(--ui-space-4);
}

.finish-score-row {
  display: flex;
  align-items: flex-end;
  gap: var(--ui-space-4);
}

.finish-score-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  min-width: 0;
}

.finish-score-label {
  font-size: var(--ui-text-body);
  font-weight: 500;
  color: var(--ui-color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.finish-score-input {
  box-sizing: border-box;
  width: 100%;
  height: var(--ui-control-min-height);
  padding: 0 var(--ui-space-4);
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-page);
  font-size: var(--ui-text-title);
  font-weight: var(--ui-font-weight-heading);
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--ui-color-text);
}

.finish-score-separator {
  font-size: 36rpx;
  font-weight: var(--ui-font-weight-heading);
  color: var(--ui-color-text-muted);
  padding-bottom: var(--ui-space-4);
}

.finish-score-error {
  font-size: var(--ui-text-sm);
  color: var(--ui-color-danger-fg);
  line-height: 1.4;
}
</style>
