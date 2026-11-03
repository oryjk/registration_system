<script setup lang="ts">
// #ifdef MP-WEIXIN
import AppIcon from "@/components/ui/AppIcon.vue";
// #endif
import { useMinioImages } from "@/composables/useMinioImages";
import { useAccentTheme } from "@/stores/theme";
const { themePageStyle } = useAccentTheme();
import { computed } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import SmoothCollapse from "@/components/ui/SmoothCollapse.vue";
import type { BackendTeamMember, BackendTeamMemberAttendanceRecord } from "@/types/backend";
import type { buildAttendanceGroups, buildAttendanceSummary } from "../teamManageState";

const { minioImageSrc } = useMinioImages();

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
    :custom-style="themePageStyle"
    v-model="visible"
    position="bottom"
    custom-class="member-attendance-popup"
    :close-on-click-modal="!loading"
    safe-area-inset-bottom
    root-portal
    lock-scroll
    @close="handleClose"
  >
    <view class="app-theme-scope member-attendance-sheet" :style="themePageStyle" @touchmove.stop>
      <view class="member-edit-header">
        <view class="attendance-profile">
          <image v-if="member && memberAvatarUrl" class="member-avatar" :src="minioImageSrc(memberAvatarUrl)" mode="aspectFill" />
          <view v-else class="member-avatar member-avatar-fallback">
            {{ member ? memberInitial : "队" }}
          </view>
          <view>
            <text class="member-edit-kicker">队员出场记录</text>
            <text class="member-edit-title">{{ member ? memberName : "队员" }}</text>
          </view>
        </view>
        <AppButton variant="outline" size="sm" @click="handleClose">关闭</AppButton>
      </view>
      <view class="attendance-summary-grid">
        <view class="attendance-summary-card ui-plain-panel">
          <text class="attendance-summary-value">{{ summary.attended }}</text>
          <text class="attendance-summary-label">参加</text>
        </view>
        <view class="attendance-summary-card ui-plain-panel">
          <text class="attendance-summary-value">{{ summary.leave }}</text>
          <text class="attendance-summary-label">请假</text>
        </view>
        <view class="attendance-summary-card ui-plain-panel">
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
              <!-- #ifdef MP-WEIXIN -->
              <view class="attendance-year-control"><AppIcon :name="group.collapsed ? 'chevron-down' : 'chevron-up'" tone="muted" /></view>
              <!-- #endif -->
              <!-- #ifndef MP-WEIXIN -->
              <text :class="['attendance-year-arrow', group.collapsed ? 'attendance-year-arrow-collapsed' : '']" class="ui-arrow-text">⌃</text>
              <!-- #endif -->
            </view>
          </view>
          <SmoothCollapse :visible="!group.collapsed">
            <view class="attendance-year-records">
              <view v-for="record in group.records" :key="record.activity_id" class="attendance-item ui-list-row">
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
          </SmoothCollapse>
        </view>
      </scroll-view>
      <view v-else class="empty-box attendance-empty">暂无球队比赛记录。</view>
    </view>
  </wd-popup>
</template>

<style scoped>
@import "@/styles/list-surfaces.css";
:deep(.member-attendance-popup) {
  border-top: var(--ui-border-default);
  border-radius: var(--ui-radius-md) var(--ui-radius-md) 0 0;
  background: var(--ui-color-surface);
}

.member-attendance-sheet {
  padding: 34rpx 30rpx 38rpx;
  background: var(--ui-color-surface);
  border-radius: var(--ui-radius-md) var(--ui-radius-md) 0 0;
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
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 500;
}

.member-edit-title {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-color-text);
  font-size: 38rpx;
  font-weight: 600;
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
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  flex-shrink: 0;
  overflow: hidden;
  background: var(--ui-color-text);
}

.member-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ui-color-accent);
  font-size: 30rpx;
  font-weight: 600;
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
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  box-shadow: none;
  text-align: center;
  box-sizing: border-box;
}

.attendance-summary-value {
  display: block;
  color: var(--ui-color-text);
  font-size: 34rpx;
  font-weight: 600;
  line-height: 1.1;
}

.attendance-summary-label {
  display: block;
  margin-top: 6rpx;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  font-weight: 500;
}

.empty-box {
  margin-top: 22rpx;
  padding: 22rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text-muted);
  font-size: 26rpx;
  font-weight: 400;
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
  padding: 8rpx 10rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  box-sizing: border-box;
}

.attendance-year-title {
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: 600;
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
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-muted);
  color: var(--ui-color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  font-weight: 600;
  box-sizing: border-box;
}

.attendance-year-chip-joined {
  background: var(--ui-color-success-bg);
  color: var(--ui-color-success-fg);
}

.attendance-year-chip-leave {
  background: var(--ui-color-warning-bg);
  color: var(--ui-color-warning-fg);
}

.attendance-year-arrow {
  width: 34rpx;
  height: 34rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-text);
  color: var(--ui-color-accent);
  display: flex;
  align-items: center;
  transition: transform var(--ui-motion-switch-duration) var(--ui-motion-ease-out);
  justify-content: center;
  font-size: 20rpx;
  font-weight: 600;
  line-height: 1;
  transform: rotate(0deg);
}

.attendance-year-arrow-collapsed {
  transform: rotate(180deg);
}

/* 年度记录展开淡入：保持布局、内容轻淡入（≤8rpx 位移）。 */
.attendance-year-records {
  animation: attendance-records-fade-in var(--ui-motion-expand-duration) var(--ui-motion-ease-out);
}

@keyframes attendance-records-fade-in {
  from {
    opacity: 0;
    transform: translateY(8rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* H5 减少动态效果：记录直接出现、箭头直接切换。 */
@media (prefers-reduced-motion: reduce) {
  .attendance-year-records {
    animation: none;
  }
  .attendance-year-arrow {
    transition: none;
  }
}

.attendance-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 10rpx;
  padding: 18rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
}

.attendance-item-main {
  flex: 1;
  min-width: 0;
}

.attendance-item-title {
  display: block;
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: 600;
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.attendance-item-meta {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  font-weight: 400;
  overflow-wrap: anywhere;
  line-height: 1.5;
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
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-round);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 600;
  box-sizing: border-box;
}

.attendance-status-joined {
  background: var(--ui-color-success-bg);
  color: var(--ui-color-success-fg);
}

.attendance-status-leave {
  background: var(--ui-color-warning-bg);
  color: var(--ui-color-warning-fg);
}

.attendance-status-late {
  background: var(--ui-color-info-soft);
  color: var(--ui-color-text);
}

.attendance-status-pending,
.attendance-status-unregistered {
  background: var(--ui-color-muted);
  color: var(--ui-color-text-muted);
}

.attendance-item-count {
  color: var(--ui-color-text-muted);
  font-size: 20rpx;
  font-weight: 500;
}

.attendance-empty {
  margin-top: 18rpx;
}

/* #ifdef MP-WEIXIN */
/* 微信端复用统一排版尺度；H5 保留原有样式。 */
.member-attendance-sheet { padding: var(--ui-panel-padding) var(--ui-page-padding-inline); }
.member-edit-header { gap: var(--ui-space-5); margin-bottom: var(--ui-space-5); }
.member-edit-kicker { font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-medium); }
.member-edit-title { margin-top: var(--ui-space-2); font-size: var(--ui-text-display); font-weight: var(--ui-font-weight-heading); }
.attendance-profile { gap: var(--ui-space-4); }
.member-avatar-fallback { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); }
.attendance-summary-grid { gap: var(--ui-space-3); margin: var(--ui-space-5) 0 var(--ui-space-4); }
.attendance-summary-card { padding: var(--ui-space-4) var(--ui-space-2); border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); background: transparent; }
.attendance-summary-value { font-size: var(--ui-text-heading); font-weight: var(--ui-font-weight-heading); line-height: var(--ui-line-height-tight); }
.attendance-summary-label { margin-top: var(--ui-space-1); font-size: var(--ui-text-sm); font-weight: var(--ui-font-weight-medium); }
.empty-box { margin-top: var(--ui-space-5); padding: var(--ui-panel-padding) 0; font-size: var(--ui-text-label); font-weight: var(--ui-font-weight-body); border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); background: transparent; }
.attendance-year-group { margin-top: var(--ui-space-3); }
.attendance-year-header { gap: var(--ui-space-4); padding: var(--ui-space-3) 0; border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); border-bottom: var(--ui-list-divider); }
.attendance-year-title { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); }
.attendance-year-stats { gap: var(--ui-space-2); }
.attendance-year-chip { padding: 0 var(--ui-space-3); font-size: var(--ui-text-xs); font-weight: var(--ui-font-weight-heading); }
.attendance-year-arrow { font-size: var(--ui-text-xs); font-weight: var(--ui-font-weight-heading); border: var(--ui-control-border); background: var(--ui-control-subtle-bg); color: var(--ui-color-text); }
.attendance-item { gap: var(--ui-space-4); margin-top: 0; padding: var(--ui-list-row-padding) 0; border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); }
.attendance-item-title { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); line-height: var(--ui-line-height-body); }
.attendance-item-meta { margin-top: var(--ui-space-2); font-size: var(--ui-text-sm); font-weight: var(--ui-font-weight-body); line-height: var(--ui-line-height-body); }
.attendance-item-side { gap: var(--ui-space-2); }
.attendance-status { padding: 0 var(--ui-space-3); font-size: var(--ui-text-sm); font-weight: var(--ui-font-weight-heading); }
.attendance-item-count { font-size: var(--ui-text-xs); font-weight: var(--ui-font-weight-medium); }
.attendance-empty { margin-top: var(--ui-space-4); }
.attendance-summary-card + .attendance-summary-card { border-left: var(--ui-list-divider); }
.attendance-year-chip, .attendance-status { border: var(--ui-control-border); }
.attendance-item + .attendance-item { border-top: var(--ui-list-divider); }
.member-avatar { border: var(--ui-panel-border); }
/* #endif */

/* #ifdef MP-WEIXIN */
.attendance-profile { flex: 1; min-width: 0; }
.attendance-profile > view { flex: 1; min-width: 0; }
.member-edit-title { font-size: var(--ui-text-title); overflow-wrap: anywhere; }
.member-edit-kicker, .attendance-summary-label, .attendance-item-meta, .attendance-item-count, .empty-box { color: var(--ui-color-text-secondary); }
.member-avatar { border-radius: var(--ui-radius-round); background: var(--ui-color-neutral-bg); }
.member-avatar-fallback { color: var(--ui-color-text); }
.attendance-year-control { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: var(--ui-control-min-height); height: var(--ui-control-min-height); }
.attendance-year-header { min-height: var(--ui-control-min-height); }
.attendance-year-title { flex-shrink: 0; }
.attendance-year-stats { gap: var(--ui-space-1); }
.attendance-item-side { width: auto; min-width: var(--ui-control-min-height); }
.attendance-summary-label { font-weight: var(--ui-font-weight-body); }
/* #endif */
</style>
