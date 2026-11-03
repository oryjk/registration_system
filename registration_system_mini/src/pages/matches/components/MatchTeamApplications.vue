<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import AppTag from "@/components/ui/AppTag.vue";
import type { AppTeamApplication, AppTeamApplicationStatus } from "@/types/match";
import type { AppTagTone } from "@/types/designSystem";
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

const STATUS_LABELS: Record<AppTeamApplicationStatus, { label: string; tone: AppTagTone }> = {
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
  <AppSurface variant="raised">
    <view class="applications-head">
      <text class="applications-title">接约申请</text>
      <AppTag v-if="isLoading" tone="muted">加载中</AppTag>
    </view>

    <view v-if="loadErrorMessage" class="applications-hint ui-soft-panel">{{ loadErrorMessage }}</view>
    <view v-else-if="!isLoading && !applications.length" class="applications-hint ui-soft-panel">
      还没有球队申请。可以把比赛分享给其他队长，或等待对手主动上门。
    </view>

    <view
      v-for="application in applications"
      :key="application.id"
      class="application-card ui-list-row"
    >
      <view class="application-head">
        <text class="application-team">{{ teamLabel(application) }}</text>
        <AppTag :tone="statusOf(application).tone" size="lg">{{ statusOf(application).label }}</AppTag>
      </view>
      <text class="application-time">{{ formatDateTimeWithWeekdayLabel(application.created_at) }} 提交</text>
      <text class="application-introduction">{{ application.introduction }}</text>

      <AppButton
        v-if="application.status === 'pending'"
        class="application-select-button"
        :loading="isSelecting"
        :disabled="isSelecting"
        @click="emit('selectOpponent', application)"
      >
        选为对手
      </AppButton>
    </view>
  </AppSurface>
</template>

<style scoped>
@import "@/styles/list-surfaces.css";
.applications-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.applications-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--ui-color-text);
}

.applications-hint {
  margin-top: 18rpx;
  padding: 20rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-muted);
  font-size: 24rpx;
  line-height: 1.6;
  font-weight: 600;
  color: var(--ui-color-text-muted);
}

.application-card {
  margin-top: 18rpx;
  padding: 20rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
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
  font-weight: 600;
  color: var(--ui-color-text);
}

.application-time {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: var(--ui-color-text-muted);
}

.application-introduction {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.6;
  font-weight: 600;
  color: var(--ui-color-text);
}

.application-select-button {
  margin-top: 18rpx;
  min-width: 200rpx;
}

/* #ifdef MP-WEIXIN */
.application-card { padding: var(--ui-list-row-padding) 0; margin-top: var(--ui-space-4); border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); background: transparent; }
.application-card + .application-card { border-top: var(--ui-list-divider); }
.applications-hint { border: var(--ui-panel-border); background: var(--ui-panel-soft-bg); padding: var(--ui-panel-padding); font-weight: var(--ui-font-weight-body); }
.applications-title { font-size: var(--ui-text-subtitle); }
.application-head { align-items: flex-start; }
.application-team { min-width: 0; overflow-wrap: anywhere; font-size: var(--ui-text-subtitle); line-height: var(--ui-line-height-compact); }
.application-introduction { overflow-wrap: anywhere; font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-body); line-height: var(--ui-line-height-body); }
.application-time { font-weight: var(--ui-font-weight-body); line-height: var(--ui-line-height-compact); color: var(--ui-color-text-secondary); }
/* #endif */
</style>
