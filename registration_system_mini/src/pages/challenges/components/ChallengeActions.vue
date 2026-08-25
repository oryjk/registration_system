<script setup lang="ts">
import type { BackendChallengeActivityRef } from "@/types/backend";
import type { ChallengeCardViewModel } from "@/types/viewModels";

defineProps<{
  activity?: BackendChallengeActivityRef | null;
  card: ChallengeCardViewModel;
  canAccept: boolean;
  canCancel: boolean;
  canCancelIndividualAcceptance: boolean;
  actionLoading: boolean;
}>();

defineEmits<{
  openActivities: [];
  openMatchDetail: [matchId: string];
  accept: [];
  cancel: [];
  cancelIndividualAcceptance: [];
}>();
</script>

<template>
  <view class="challenge-actions">
    <view class="challenge-ghost-button" @tap="$emit('openActivities')">回大厅</view>
    <view
      v-if="activity"
      class="challenge-primary-button"
      @tap="$emit('openMatchDetail', activity.id)"
    >
      去比赛详情
    </view>
    <view v-else-if="canAccept" class="challenge-primary-button" @tap="$emit('accept')">
      {{ actionLoading ? "处理中..." : card.kind === "team" ? "以当前球队接约" : "报名" }}
    </view>
    <view v-else-if="canCancelIndividualAcceptance" class="challenge-danger-button" @tap="$emit('cancelIndividualAcceptance')">
      {{ actionLoading ? "处理中..." : "取消报名" }}
    </view>
    <view v-else-if="canCancel" class="challenge-danger-button" @tap="$emit('cancel')">
      {{ actionLoading ? "处理中..." : "取消约队" }}
    </view>
  </view>
</template>

<style scoped>
.challenge-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 22rpx;
}

.challenge-primary-button,
.challenge-ghost-button,
.challenge-danger-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 82rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 900;
}

.challenge-primary-button {
  background: var(--neo-color-accent);
  color: #131410;
}

.challenge-ghost-button {
  background: #ffffff;
  border: 2rpx solid #d9ddd3;
  color: #171814;
}

.challenge-danger-button {
  background: #ffe9ec;
  color: #cf455d;
}
</style>
