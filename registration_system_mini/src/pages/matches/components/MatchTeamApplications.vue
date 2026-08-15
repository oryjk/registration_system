<script setup lang="ts">
import { NeoButton, NeoSurface, NeoTag } from "@/components/neo";
import type { AppTeamApplication, AppTeamApplicationStatus } from "@/types/match";
import type { NeoTagTone } from "@/types/designSystem";
import { formatDateTimeWithWeekdayLabel } from "@/utils/datetime";

defineProps<{
  applications: AppTeamApplication[];
  isLoading: boolean;
  isSelecting: boolean;
  loadErrorMessage: string;
}>();

const emit = defineEmits<{
  (event: "selectOpponent", application: AppTeamApplication): void;
}>();

const STATUS_LABELS: Record<AppTeamApplicationStatus, { label: string; tone: NeoTagTone }> = {
  pending: { label: "等待选择", tone: "amber" },
  selected: { label: "已选为对手", tone: "green" },
  rejected: { label: "已婉拒", tone: "muted" },
  withdrawn: { label: "已撤回", tone: "muted" },
};

function teamLabel(application: AppTeamApplication): string {
  return application.applicant_team_name || `球队 #${application.applicant_team_id}`;
}

function statusOf(application: AppTeamApplication) {
  return STATUS_LABELS[application.status] ?? STATUS_LABELS.pending;
}
</script>

<template>
  <NeoSurface variant="raised">
    <view class="applications-head">
      <text class="applications-title">接约申请</text>
      <NeoTag v-if="isLoading" tone="muted">加载中</NeoTag>
    </view>

    <view v-if="loadErrorMessage" class="applications-hint">{{ loadErrorMessage }}</view>
    <view v-else-if="!isLoading && !applications.length" class="applications-hint">
      还没有球队申请。可以把比赛分享给其他队长，或等待对手主动上门。
    </view>

    <view
      v-for="application in applications"
      :key="application.id"
      class="application-card"
    >
      <view class="application-head">
        <text class="application-team">{{ teamLabel(application) }}</text>
        <NeoTag :tone="statusOf(application).tone" size="lg">{{ statusOf(application).label }}</NeoTag>
      </view>
      <text class="application-time">{{ formatDateTimeWithWeekdayLabel(application.created_at) }} 提交</text>
      <text class="application-introduction">{{ application.introduction }}</text>

      <NeoButton
        v-if="application.status === 'pending'"
        class="application-select-button"
        :loading="isSelecting"
        :disabled="isSelecting"
        @click="emit('selectOpponent', application)"
      >
        选为对手
      </NeoButton>
    </view>
  </NeoSurface>
</template>

<style scoped>
.applications-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.applications-title {
  font-size: 30rpx;
  font-weight: 900;
  color: var(--neo-color-text);
}

.applications-hint {
  margin-top: 18rpx;
  padding: 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  font-size: 24rpx;
  line-height: 1.6;
  font-weight: 600;
  color: var(--neo-color-text-muted);
}

.application-card {
  margin-top: 18rpx;
  padding: 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
}

.application-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.application-team {
  flex: 1;
  font-size: 28rpx;
  font-weight: 900;
  color: var(--neo-color-text);
}

.application-time {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: var(--neo-color-text-muted);
}

.application-introduction {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.6;
  font-weight: 600;
  color: var(--neo-color-text);
}

.application-select-button {
  margin-top: 18rpx;
  min-width: 200rpx;
}
</style>
