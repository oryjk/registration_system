<script setup lang="ts">
import type { TeamActivityAttendanceMember, TeamActivityAttendanceSummary } from "../teamManageState";
import type { TeamProfileViewModel } from "@/types/viewModels";

defineProps<{
  currentTeam: TeamProfileViewModel | null;
  loading: boolean;
  summaries: TeamActivityAttendanceSummary[];
  formatAttendanceDate: (isoText: string) => string;
}>();

function memberStatusClass(member: TeamActivityAttendanceMember) {
  return `activity-member-status activity-member-status-${member.statusTone}`;
}
</script>

<template>
  <view class="form-card attendance-panel">
    <view class="attendance-panel-head">
      <view>
        <text class="form-title">比赛出勤</text>
        <text class="attendance-panel-copy">按比赛查看当前球队每位队员的报名与打卡情况</text>
      </view>
      <view v-if="summaries.length" class="attendance-total-pill">
        <text>{{ summaries.length }}</text>
        <text>场</text>
      </view>
    </view>

    <view v-if="!currentTeam" class="empty-box">请先创建或加入球队。</view>
    <view v-else-if="loading" class="empty-box">正在汇总球队出勤...</view>
    <view v-else-if="!summaries.length" class="empty-box">暂无可展示的球队比赛出勤。</view>
    <view v-else class="activity-attendance-list">
      <view v-for="summary in summaries" :key="summary.activityId" class="activity-attendance-card">
        <view class="activity-card-topline">
          <view class="activity-card-main">
            <text class="activity-name">{{ summary.activityName }}</text>
            <text class="activity-meta">{{ formatAttendanceDate(summary.holdingDate) }} · {{ summary.location || "地点待定" }}</text>
          </view>
          <view class="activity-total-badge">
            <text>{{ summary.members.length }}</text>
            <text>人</text>
          </view>
        </view>

        <view class="activity-stat-grid">
          <view class="activity-stat activity-stat-joined">
            <text class="activity-stat-value">{{ summary.attended }}</text>
            <text class="activity-stat-label">参加</text>
          </view>
          <view class="activity-stat activity-stat-leave">
            <text class="activity-stat-value">{{ summary.leave }}</text>
            <text class="activity-stat-label">请假</text>
          </view>
          <view class="activity-stat activity-stat-unchecked">
            <text class="activity-stat-value">{{ summary.unchecked }}</text>
            <text class="activity-stat-label">未打卡</text>
          </view>
        </view>

        <view class="activity-member-list">
          <view v-for="member in summary.members" :key="`${summary.activityId}-${member.userId}`" class="activity-member-row">
            <image v-if="member.avatarUrl" class="activity-member-avatar" :src="member.avatarUrl" mode="aspectFill" />
            <view v-else class="activity-member-avatar activity-member-avatar-fallback">
              <text>{{ member.initial }}</text>
            </view>
            <view class="activity-member-copy">
              <text class="activity-member-name">{{ member.name }}</text>
              <text class="activity-member-meta">报名人数 {{ member.registrationCount }}</text>
            </view>
            <text :class="memberStatusClass(member)">{{ member.statusLabel }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.form-card {
  padding: 30rpx;
  border-radius: 32rpx;
  background: #ffffff;
  box-shadow: 0 18rpx 36rpx rgba(16, 17, 15, 0.06);
}

.form-title {
  display: block;
  color: #10110f;
  font-size: 34rpx;
  font-weight: 900;
}

.attendance-panel {
  position: relative;
  overflow: hidden;
}

.attendance-panel::before {
  content: "";
  position: absolute;
  top: -92rpx;
  right: -72rpx;
  width: 220rpx;
  height: 220rpx;
  border-radius: 999rpx;
  background: rgba(200, 255, 0, 0.18);
}

.attendance-panel-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 22rpx;
}

.attendance-panel-copy {
  display: block;
  margin-top: 8rpx;
  color: #697064;
  font-size: 24rpx;
  line-height: 1.45;
  font-weight: 700;
}

.attendance-total-pill {
  min-width: 86rpx;
  height: 62rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  background: #10110f;
  color: #c8ff00;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  font-size: 24rpx;
  font-weight: 900;
  box-sizing: border-box;
  flex-shrink: 0;
}

.empty-box {
  position: relative;
  z-index: 1;
  margin-top: 22rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: #f3f5ef;
  color: #6b7166;
  font-size: 26rpx;
  font-weight: 700;
}

.activity-attendance-list {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.activity-attendance-card {
  padding: 22rpx;
  border-radius: 28rpx;
  background:
    linear-gradient(135deg, rgba(16, 17, 15, 0.96) 0%, rgba(34, 38, 29, 0.96) 56%, rgba(44, 52, 31, 0.94) 100%);
  box-shadow: 0 18rpx 34rpx rgba(16, 17, 15, 0.16);
  overflow: hidden;
}

.activity-card-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.activity-card-main {
  min-width: 0;
  flex: 1;
}

.activity-name {
  display: block;
  color: #ffffff;
  font-size: 31rpx;
  line-height: 1.25;
  font-weight: 950;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-meta {
  display: block;
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.68);
  font-size: 22rpx;
  line-height: 1.35;
  font-weight: 750;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-total-badge {
  min-width: 72rpx;
  height: 54rpx;
  padding: 0 14rpx;
  border-radius: 18rpx;
  background: rgba(200, 255, 0, 0.14);
  color: #c8ff00;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3rpx;
  font-size: 22rpx;
  font-weight: 900;
  box-sizing: border-box;
  flex-shrink: 0;
}

.activity-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 18rpx;
}

.activity-stat {
  min-width: 0;
  padding: 16rpx 8rpx 14rpx;
  border-radius: 22rpx;
  text-align: center;
  box-sizing: border-box;
}

.activity-stat-joined {
  background: rgba(200, 255, 0, 0.15);
  color: #c8ff00;
}

.activity-stat-leave {
  background: rgba(255, 183, 64, 0.16);
  color: #ffbf51;
}

.activity-stat-unchecked {
  background: rgba(255, 92, 92, 0.16);
  color: #ff7474;
}

.activity-stat-value {
  display: block;
  font-size: 34rpx;
  line-height: 1;
  font-weight: 950;
}

.activity-stat-label {
  display: block;
  margin-top: 7rpx;
  font-size: 20rpx;
  font-weight: 900;
}

.activity-member-list {
  margin-top: 14rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.activity-member-row {
  min-height: 82rpx;
  padding: 12rpx 14rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.09);
  box-sizing: border-box;
}

.activity-member-row:last-child {
  border-bottom: 0;
}

.activity-member-avatar {
  width: 54rpx;
  height: 54rpx;
  border-radius: 18rpx;
  flex-shrink: 0;
  overflow: hidden;
  background: #f2f5ec;
}

.activity-member-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #111310;
  font-size: 22rpx;
  font-weight: 950;
}

.activity-member-copy {
  min-width: 0;
  flex: 1;
}

.activity-member-name {
  display: block;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-member-meta {
  display: block;
  margin-top: 4rpx;
  color: rgba(255, 255, 255, 0.48);
  font-size: 19rpx;
  font-weight: 750;
}

.activity-member-status {
  min-width: 84rpx;
  height: 42rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 21rpx;
  font-weight: 950;
  box-sizing: border-box;
  flex-shrink: 0;
}

.activity-member-status-joined {
  background: #c8ff00;
  color: #10110f;
}

.activity-member-status-leave {
  background: #ffbf51;
  color: #251600;
}

.activity-member-status-unchecked {
  background: #ff6f6f;
  color: #ffffff;
}
</style>
