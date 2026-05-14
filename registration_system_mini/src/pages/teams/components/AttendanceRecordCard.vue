<script setup lang="ts">
import {
  attendanceStatusClass,
  attendanceStatusLabel,
  formatDateLabel,
  type AttendanceRecordGroup,
} from "../teamStatsState";

defineProps<{
  myRecordsCount: number;
  attendanceGroups: AttendanceRecordGroup[];
  embedded?: boolean;
}>();

defineEmits<{
  toggleYear: [year: string];
}>();
</script>

<template>
  <view :class="['stats-card', embedded ? 'stats-card-embedded' : '']">
    <view class="stats-card-head">
      <view>
        <text class="stats-card-title">我的出勤记录</text>
        <text class="stats-card-caption">当前球队全部已结束比赛记录</text>
      </view>
    </view>

    <view v-if="myRecordsCount" class="attendance-list">
      <view v-for="group in attendanceGroups" :key="group.year" class="attendance-year-group">
        <view class="attendance-year-header" @tap="$emit('toggleYear', group.year)">
          <text class="attendance-year-title">{{ group.year }}</text>
          <view class="attendance-year-stats">
            <text class="attendance-year-chip">{{ group.total }} 场</text>
            <text class="attendance-year-chip attendance-year-chip-joined">参加 {{ group.attended }}</text>
            <text class="attendance-year-chip attendance-year-chip-leave">请假 {{ group.leave }}</text>
            <text :class="['attendance-year-arrow', group.collapsed ? 'attendance-year-arrow-collapsed' : '']">⌃</text>
          </view>
        </view>

        <view v-if="!group.collapsed" class="attendance-year-records">
          <view v-for="record in group.records" :key="record.activity_id" class="attendance-item">
            <view class="attendance-item-main">
              <text class="attendance-item-title">{{ record.activity_name }}</text>
              <text class="attendance-item-meta">{{ formatDateLabel(record.holding_date) }} · {{ record.location }}</text>
            </view>
            <view class="attendance-item-side">
              <text :class="attendanceStatusClass(record)">{{ attendanceStatusLabel(record) }}</text>
              <text class="attendance-item-count">{{ record.registration_count }} 人</text>
            </view>
          </view>
        </view>
      </view>
    </view>
    <view v-else class="stats-empty stats-empty-inner">今年还没有球队比赛记录。</view>
  </view>
</template>

<style scoped>
.stats-card {
  margin-top: 16rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: #ffffff;
  border: 1rpx solid rgba(31, 35, 26, 0.07);
  box-shadow: 0 14rpx 32rpx rgba(20, 24, 16, 0.05);
}

.stats-card-embedded {
  margin-top: 0;
  padding: 0;
  border: 0;
  box-shadow: none;
}

.stats-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.stats-card-title {
  display: block;
  font-size: 29rpx;
  line-height: 1.2;
  color: #151812;
  font-weight: 900;
}

.stats-card-caption {
  display: block;
  margin-top: 6rpx;
  font-size: 21rpx;
  color: #747b70;
  font-weight: 700;
}

.attendance-list {
  margin-top: 18rpx;
}

.attendance-year-group {
  border-top: 1rpx solid #eef1ea;
}

.attendance-year-group:first-child {
  border-top: 0;
}

.attendance-year-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  min-height: 62rpx;
  padding: 8rpx 0;
}

.attendance-year-title {
  font-size: 27rpx;
  color: #171a13;
  font-weight: 900;
  white-space: nowrap;
}

.attendance-year-stats {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
  min-width: 0;
  flex: 1;
}

.attendance-year-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 62rpx;
  padding: 7rpx 10rpx;
  border-radius: 999rpx;
  background: #f2f4ee;
  color: #687064;
  font-size: 20rpx;
  font-weight: 800;
  white-space: nowrap;
}

.attendance-year-chip-joined {
  background: #eef8d6;
  color: #506a00;
}

.attendance-year-chip-leave {
  background: #f1f2ee;
  color: #5d6359;
}

.attendance-year-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34rpx;
  height: 34rpx;
  color: #80877a;
  font-size: 22rpx;
  font-weight: 900;
  transform: rotate(0deg);
  transition: transform 0.18s ease;
  flex-shrink: 0;
}

.attendance-year-arrow-collapsed {
  transform: rotate(180deg);
}

.attendance-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 16rpx 0;
  border-top: 1rpx solid #f2f4ef;
}

.attendance-item-main {
  min-width: 0;
  flex: 1;
}

.attendance-item-title {
  display: block;
  overflow: hidden;
  color: #171a13;
  font-size: 27rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attendance-item-meta {
  display: block;
  margin-top: 7rpx;
  overflow: hidden;
  color: #737b70;
  font-size: 21rpx;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attendance-item-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 112rpx;
}

.stats-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 88rpx;
  padding: 8rpx 13rpx;
  border-radius: 999rpx;
  font-size: 21rpx;
  font-weight: 850;
}

.stats-status-joined {
  background: #eef8d6;
  color: #456100;
}

.stats-status-leave {
  background: #f0f2ee;
  color: #5f645d;
}

.stats-status-late {
  background: #fff1df;
  color: #a36100;
}

.stats-status-pending,
.stats-status-unregistered {
  background: #eceff4;
  color: #5e6473;
}

.attendance-item-count {
  display: block;
  margin-top: 7rpx;
  color: #8a9085;
  font-size: 20rpx;
  font-weight: 700;
}

.stats-empty {
  margin-top: 18rpx;
  padding: 24rpx;
  border-radius: 22rpx;
  background: #ffffff;
  color: #6c7168;
  font-size: 27rpx;
  line-height: 1.6;
}

.stats-empty-inner {
  margin-top: 16rpx;
  background: #f7f8f3;
}
</style>
