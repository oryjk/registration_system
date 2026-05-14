<script setup lang="ts">
import { computed } from "vue";
import type { BackendTeamMember, BackendTeamMemberAttendanceRecord } from "@/types/backend";
import type { buildAttendanceGroups, buildAttendanceSummary } from "../teamManageState";

type AttendanceSummary = ReturnType<typeof buildAttendanceSummary>;
type AttendanceGroups = ReturnType<typeof buildAttendanceGroups>;

const props = defineProps<{
  modelValue: boolean;
  member: BackendTeamMember | null;
  memberName: string;
  memberAvatarUrl: string;
  memberInitial: string;
  loading: boolean;
  records: BackendTeamMemberAttendanceRecord[];
  summary: AttendanceSummary;
  groups: AttendanceGroups;
  formatAttendanceDate: (isoText: string) => string;
  attendanceStatusClass: (record: BackendTeamMemberAttendanceRecord) => string;
  attendanceStatusLabel: (record: BackendTeamMemberAttendanceRecord) => string;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "close"): void;
  (event: "toggle-year", year: string): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

function handleClose() {
  emit("close");
}

function handleToggleYear(year: string) {
  emit("toggle-year", year);
}
</script>

<template>
  <wd-popup
    v-model="visible"
    position="bottom"
    custom-class="member-attendance-popup"
    :close-on-click-modal="!loading"
    safe-area-inset-bottom
    root-portal
    lock-scroll
    @close="handleClose"
  >
    <view class="member-attendance-sheet" @touchmove.stop>
      <view class="member-edit-header">
        <view class="attendance-profile">
          <image v-if="member && memberAvatarUrl" class="member-avatar" :src="memberAvatarUrl" mode="aspectFill" />
          <view v-else class="member-avatar member-avatar-fallback">
            {{ member ? memberInitial : "队" }}
          </view>
          <view>
            <text class="member-edit-kicker">队员出场记录</text>
            <text class="member-edit-title">{{ member ? memberName : "队员" }}</text>
          </view>
        </view>
        <view class="member-edit-close" @tap="handleClose">关闭</view>
      </view>

      <view class="attendance-summary-grid">
        <view class="attendance-summary-card">
          <text class="attendance-summary-value">{{ summary.attended }}</text>
          <text class="attendance-summary-label">参加</text>
        </view>
        <view class="attendance-summary-card">
          <text class="attendance-summary-value">{{ summary.leave }}</text>
          <text class="attendance-summary-label">请假</text>
        </view>
        <view class="attendance-summary-card">
          <text class="attendance-summary-value">{{ summary.unregistered }}</text>
          <text class="attendance-summary-label">未报名</text>
        </view>
      </view>

      <view v-if="loading" class="empty-box attendance-empty">正在加载出场记录...</view>
      <scroll-view v-else-if="records.length" class="attendance-list" scroll-y>
        <view v-for="group in groups" :key="group.year" class="attendance-year-group">
          <view class="attendance-year-header" @tap="handleToggleYear(group.year)">
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
                <text class="attendance-item-meta">{{ formatAttendanceDate(record.holding_date) }} · {{ record.location }}</text>
              </view>
              <view class="attendance-item-side">
                <text :class="attendanceStatusClass(record)">{{ attendanceStatusLabel(record) }}</text>
                <text class="attendance-item-count">{{ record.registration_count }} 人</text>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
      <view v-else class="empty-box attendance-empty">暂无球队比赛记录。</view>
    </view>
  </wd-popup>
</template>

<style scoped>
:deep(.member-attendance-popup) {
  border-radius: 34rpx 34rpx 0 0;
  background: #ffffff;
}

.member-attendance-sheet {
  padding: 34rpx 30rpx 38rpx;
  background: #ffffff;
  border-radius: 34rpx 34rpx 0 0;
}

.member-edit-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 22rpx;
}

.member-edit-kicker {
  display: block;
  color: #6a7165;
  font-size: 24rpx;
  font-weight: 800;
}

.member-edit-title {
  display: block;
  margin-top: 8rpx;
  color: #10110f;
  font-size: 38rpx;
  font-weight: 900;
}

.member-edit-close {
  height: 58rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #edf0e7;
  color: #5d6458;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 900;
}

.attendance-profile {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
}

.member-avatar {
  width: 76rpx;
  height: 76rpx;
  border-radius: 22rpx;
  flex-shrink: 0;
  overflow: hidden;
  background: #111310;
}

.member-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c8ff00;
  font-size: 30rpx;
  font-weight: 900;
}

.attendance-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin: 20rpx 0 18rpx;
}

.attendance-summary-card {
  min-width: 0;
  padding: 18rpx 10rpx;
  border-radius: 22rpx;
  background: #f3f5ef;
  text-align: center;
  box-sizing: border-box;
}

.attendance-summary-value {
  display: block;
  color: #10110f;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1.1;
}

.attendance-summary-label {
  display: block;
  margin-top: 6rpx;
  color: #6a7165;
  font-size: 22rpx;
  font-weight: 800;
}

.empty-box {
  margin-top: 22rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: #f3f5ef;
  color: #6b7166;
  font-size: 26rpx;
  font-weight: 700;
}

.attendance-list {
  max-height: 58vh;
}

.attendance-year-group {
  margin-top: 12rpx;
}

.attendance-year-group:first-child {
  margin-top: 0;
}

.attendance-year-header {
  position: sticky;
  top: 0;
  z-index: 1;
  min-height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  background: #ffffff;
}

.attendance-year-title {
  color: #10110f;
  font-size: 28rpx;
  font-weight: 900;
}

.attendance-year-stats {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.attendance-year-chip {
  height: 38rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  background: #edf0e7;
  color: #6a7165;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.attendance-year-chip-joined {
  background: #dff7e7;
  color: #146c3e;
}

.attendance-year-chip-leave {
  background: #fff2d6;
  color: #9a5a00;
}

.attendance-year-arrow {
  width: 34rpx;
  height: 34rpx;
  border-radius: 999rpx;
  background: #10110f;
  color: #c8ff00;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  font-weight: 900;
  line-height: 1;
  transform: rotate(0deg);
}

.attendance-year-arrow-collapsed {
  transform: rotate(180deg);
}

.attendance-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #edf0e7;
}

.attendance-item:last-child {
  border-bottom: 0;
}

.attendance-item-main {
  flex: 1;
  min-width: 0;
}

.attendance-item-title {
  display: block;
  color: #10110f;
  font-size: 28rpx;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attendance-item-meta {
  display: block;
  margin-top: 8rpx;
  color: #6a7165;
  font-size: 22rpx;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attendance-item-side {
  width: 124rpx;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}

.attendance-status {
  height: 42rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.attendance-status-joined {
  background: #dff7e7;
  color: #146c3e;
}

.attendance-status-leave {
  background: #fff2d6;
  color: #9a5a00;
}

.attendance-status-late {
  background: #e2ecff;
  color: #264d9b;
}

.attendance-status-pending,
.attendance-status-unregistered {
  background: #edf0e7;
  color: #5f665a;
}

.attendance-item-count {
  color: #8a9184;
  font-size: 20rpx;
  font-weight: 800;
}

.attendance-empty {
  margin-top: 18rpx;
}
</style>
