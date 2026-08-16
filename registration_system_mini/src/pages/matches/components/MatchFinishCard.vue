<script setup lang="ts">
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import type { AppMatchSummary } from "@/types/match";
import { formatMonthDay, formatClock } from "../detailState";

defineProps<{
  match: AppMatchSummary;
  submittingStatus: boolean;
}>();

const emit = defineEmits<{
  (event: "openFinishDialog"): void;
}>();
</script>

<template>
  <NeoSurface variant="raised">
    <view class="finish-head">
      <text class="finish-title">比赛收尾</text>
      <text class="finish-message">
        本场比赛已于 {{ formatMonthDay(match.end_time) }} {{ formatClock(match.end_time) }} 结束，等待你确认最终结果。
      </text>
    </view>
    <NeoButton
      class="finish-button"
      :loading="submittingStatus"
      :disabled="submittingStatus"
      @click="emit('openFinishDialog')"
    >
      结束比赛
    </NeoButton>
  </NeoSurface>
</template>

<style scoped>
.finish-head {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.finish-title {
  font-size: 30rpx;
  font-weight: 900;
  color: var(--neo-color-text);
}

.finish-message {
  font-size: 24rpx;
  line-height: 1.6;
  font-weight: 600;
  color: var(--neo-color-text-muted);
}

.finish-button {
  margin-top: 20rpx;
}
</style>
