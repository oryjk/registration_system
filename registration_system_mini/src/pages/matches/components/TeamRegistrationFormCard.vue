<script setup lang="ts">
import { computed } from "vue";
import type { BackendActivity, BackendTeam } from "@/types/backend";

const props = defineProps<{
  match: BackendActivity;
  opponentTeam: BackendTeam | null;
  existingTeamDerivedActivity: BackendActivity | null;
  teamFormTitle: string;
  teamSignupHint: string;
  teamRegistrationCount: number;
  teamRegistrationCountOptions: Array<{ value: number; label: string }>;
  dateLine: string;
}>();

const emit = defineEmits<{
  "update:teamRegistrationCount": [value: number];
}>();

const teamRegistrationCountModel = computed({
  get: () => [props.teamRegistrationCount],
  set: (value) => emit("update:teamRegistrationCount", Number(value[0])),
});
</script>

<template>
  <view class="registration-card team-registration-form">
    <view class="team-form-head">
      <view>
        <text class="section-title">{{ teamFormTitle }}</text>
        <text class="team-form-copy">{{ teamSignupHint }}</text>
      </view>
      <view class="team-form-count-badge">{{ teamRegistrationCount }} 人</view>
    </view>

    <view class="team-readonly-list">
      <view class="team-readonly-field">
        <text class="team-readonly-label">比赛名称</text>
        <text class="team-readonly-value">{{ match.name }}</text>
      </view>
      <view class="team-readonly-field">
        <text class="team-readonly-label">对手</text>
        <text class="team-readonly-value">{{ match.opposing || opponentTeam?.name || "对手待定" }}</text>
      </view>
      <view class="team-readonly-field">
        <text class="team-readonly-label">比赛时间</text>
        <text class="team-readonly-value">{{ dateLine }}</text>
      </view>
      <view class="team-readonly-field">
        <text class="team-readonly-label">地点</text>
        <text class="team-readonly-value">{{ match.location }}</text>
      </view>
    </view>

    <view v-if="!existingTeamDerivedActivity" class="team-count-field">
      <text class="team-readonly-label">比赛人制</text>
      <wd-picker
        v-model="teamRegistrationCountModel"
        title="选择比赛人制"
        placeholder="请选择比赛人制"
        :columns="teamRegistrationCountOptions"
        value-key="value"
        label-key="label"
        confirm-button-text="确定"
        cancel-button-text="取消"
        custom-class="team-count-picker"
        custom-cell-class="team-count-picker-cell"
        custom-value-class="team-count-picker-value"
      />
    </view>
  </view>
</template>

<style scoped>
.registration-card {
  position: relative;
  overflow: hidden;
  border-radius: 28rpx;
  box-sizing: border-box;
}

.team-registration-form {
  padding: 26rpx;
  background: #ffffff;
  box-shadow: 0 16rpx 36rpx rgba(10, 10, 10, 0.05);
}

.section-title {
  display: block;
  color: #171717;
  font-size: 38rpx;
  line-height: 1.25;
  font-weight: 900;
}

.team-form-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.team-form-copy {
  display: block;
  margin-top: 10rpx;
  color: #666666;
  font-size: 26rpx;
  line-height: 1.5;
  font-weight: 700;
}

.team-form-count-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 118rpx;
  height: 64rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: var(--neo-color-accent);
  color: #171717;
  font-size: 28rpx;
  font-weight: 900;
  flex-shrink: 0;
}

.team-readonly-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 26rpx;
}

.team-readonly-field {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  padding: 20rpx 0;
  border-bottom: 2rpx solid #f1f1f1;
}

.team-readonly-label {
  color: #777777;
  font-size: 27rpx;
  line-height: 1.45;
  font-weight: 800;
  flex-shrink: 0;
}

.team-readonly-value {
  min-width: 0;
  color: #171717;
  font-size: 29rpx;
  line-height: 1.45;
  font-weight: 900;
  text-align: right;
  word-break: break-word;
}

.team-count-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 20rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: #f7f8f3;
}

.team-count-field :deep(.team-count-picker-cell) {
  padding: 0;
  background: transparent;
}

.team-count-field :deep(.team-count-picker-value) {
  color: #171717;
  font-size: 30rpx;
  font-weight: 900;
}
</style>
