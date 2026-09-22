<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import type { AppMatchSummary } from "@/types/match";

defineProps<{
  match: AppMatchSummary;
  /** 已录入的比分；null 表示尚未录入。 */
  recordedScore: { host: number; away: number } | null;
  /** 比赛管理员可见录入按钮。 */
  canRecord: boolean;
}>();

const emit = defineEmits<{
  (event: "openScoreDialog"): void;
}>();
</script>

<template>
  <AppSurface variant="raised">
    <view class="score-head">
      <text class="score-title">比赛比分</text>
      <text class="score-message">
        {{
          recordedScore
            ? `${match.host_team_name || "主队"} ${recordedScore.host} : ${recordedScore.away} ${match.away_team_name || match.opponent_name || "客队"}`
            : "比分尚未录入。"
        }}
      </text>
    </view>
    <AppButton
      v-if="canRecord"
      class="score-button"
      @click="emit('openScoreDialog')"
    >
      {{ recordedScore ? "修改比分" : "录入比分" }}
    </AppButton>
  </AppSurface>
</template>

<style scoped>
.score-head {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.score-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--ui-color-text);
}

.score-message {
  font-size: 26rpx;
  line-height: 1.6;
  font-weight: 400;
  color: var(--ui-color-text);
}

.score-button {
  margin-top: 20rpx;
}
</style>
