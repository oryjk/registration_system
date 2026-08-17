<script setup lang="ts">
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import type {
  BackendTeamMemberAttendanceRecord,
  BackendTeamMatchAttendance,
} from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";

interface MatchAttendanceState {
  loading: boolean;
  detail: BackendTeamMatchAttendance | null;
}

const props = defineProps<{
  currentTeam: TeamProfileViewModel | null;
  loading: boolean;
  matches: BackendTeamMemberAttendanceRecord[];
  expandedActivityId: string | null;
  matchAttendanceById: Record<string, MatchAttendanceState>;
  formatAttendanceDate: (isoText: string) => string;
}>();

const emit = defineEmits<{
  (event: "toggleActivity", activityId: string): void;
}>();

const STAND_LABELS: Record<number, { label: string; tone: "joined" | "leave" | "unchecked" }> = {
  1: { label: "参加", tone: "joined" },
  2: { label: "请假", tone: "leave" },
  3: { label: "缺席", tone: "unchecked" },
};

function memberStatus(stand: number) {
  return STAND_LABELS[stand] ?? { label: "未打卡", tone: "unchecked" as const };
}

function memberStatusClass(stand: number) {
  return `activity-member-status activity-member-status-${memberStatus(stand).tone}`;
}

function attendanceStats(detail: BackendTeamMatchAttendance) {
  let attended = 0;
  let leave = 0;
  for (const member of detail.records) {
    if (member.stand === 1) attended += 1;
    else if (member.stand === 2) leave += 1;
  }
  return { attended, leave, unchecked: detail.records.length - attended - leave };
}

function memberInitial(nickname: string) {
  return nickname.slice(0, 1) || "队";
}
</script>

<template>
  <NeoSurface custom-class="form-card attendance-panel">
    <view class="attendance-panel-head">
      <NeoSectionHeader title="比赛出勤" marker="01" caption="点击比赛查看该场每位队员的报名与打卡情况" />
      <view v-if="matches.length" class="attendance-total-badge">
        <text>{{ matches.length }}</text>
        <text>场</text>
      </view>
    </view>

    <view v-if="!currentTeam" class="empty-box">请先创建或加入球队。</view>
    <view v-else-if="loading" class="empty-box">正在加载球队比赛...</view>
    <view v-else-if="!matches.length" class="empty-box">暂无可展示的球队比赛出勤。</view>
    <view v-else class="activity-attendance-list">
      <view v-for="match in matches" :key="match.activity_id" class="activity-attendance-card">
        <view class="activity-card-topline" @tap="emit('toggleActivity', match.activity_id)">
          <view class="activity-card-main">
            <text class="activity-name">{{ match.activity_name }}</text>
            <text class="activity-meta">{{ formatAttendanceDate(match.holding_date) }} · {{ match.location || "地点待定" }}</text>
          </view>
          <text class="activity-expand-arrow" :class="{ 'activity-expand-arrow-open': expandedActivityId === match.activity_id }">›</text>
        </view>

        <template v-if="expandedActivityId === match.activity_id">
          <view v-if="matchAttendanceById[match.activity_id]?.loading" class="activity-loading">正在加载出勤明细...</view>
          <template v-else-if="matchAttendanceById[match.activity_id]?.detail">
            <view class="activity-stat-grid">
              <view class="activity-stat activity-stat-joined">
                <text class="activity-stat-value">{{ attendanceStats(matchAttendanceById[match.activity_id]!.detail!).attended }}</text>
                <text class="activity-stat-label">参加</text>
              </view>
              <view class="activity-stat activity-stat-leave">
                <text class="activity-stat-value">{{ attendanceStats(matchAttendanceById[match.activity_id]!.detail!).leave }}</text>
                <text class="activity-stat-label">请假</text>
              </view>
              <view class="activity-stat activity-stat-unchecked">
                <text class="activity-stat-value">{{ attendanceStats(matchAttendanceById[match.activity_id]!.detail!).unchecked }}</text>
                <text class="activity-stat-label">未打卡</text>
              </view>
            </view>

            <view class="activity-member-list">
              <view
                v-for="member in matchAttendanceById[match.activity_id]!.detail!.records"
                :key="`${match.activity_id}-${member.user_id}`"
                class="activity-member-row"
              >
                <image v-if="member.avatar_url" class="activity-member-avatar" :src="member.avatar_url" mode="aspectFill" />
                <view v-else class="activity-member-avatar activity-member-avatar-fallback">
                  <text>{{ memberInitial(member.nickname) }}</text>
                </view>
                <view class="activity-member-copy">
                  <text class="activity-member-name">{{ member.nickname }}</text>
                  <text class="activity-member-meta">报名人数 {{ member.registration_count }}</text>
                </view>
                <text :class="memberStatusClass(member.stand)">{{ memberStatus(member.stand).label }}</text>
              </view>
            </view>
          </template>
          <view v-else class="activity-loading">出勤明细加载失败，点击标题重试。</view>
        </template>
      </view>
    </view>
  </NeoSurface>
</template>

<style scoped>
.form-card {
  padding: 6rpx 24rpx 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  box-shadow: 8rpx 8rpx 0 var(--neo-color-text);
}

.attendance-panel {
  position: relative;
  overflow: hidden;
}

.attendance-panel-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 22rpx;
}

:deep(.attendance-panel-head .neo-section-header) {
  flex: 1;
  margin-top: 30rpx;
}

.attendance-total-badge {
  min-width: 86rpx;
  height: 62rpx;
  padding: 0 16rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-xs);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
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
  margin-top: 22rpx;
  padding: 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-warning-soft);
  color: var(--neo-color-text-muted);
  font-size: 26rpx;
  font-weight: 700;
}

.activity-attendance-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.activity-attendance-card {
  padding: 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
  overflow: hidden;
}

.activity-card-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.activity-card-main {
  min-width: 0;
  flex: 1;
}

.activity-name {
  display: block;
  color: var(--neo-color-text);
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
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  line-height: 1.35;
  font-weight: 750;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-expand-arrow {
  flex-shrink: 0;
  width: 52rpx;
  height: 52rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-round);
  background: var(--neo-color-text);
  color: var(--neo-color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  line-height: 1;
  font-weight: 900;
  box-sizing: border-box;
  transform: rotate(0deg);
  transition: transform 180ms ease;
}

.activity-expand-arrow-open {
  transform: rotate(90deg);
}

.activity-loading {
  margin-top: 16rpx;
  padding: 18rpx;
  border: 2rpx solid var(--neo-color-track);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  color: var(--neo-color-text-muted);
  font-size: 23rpx;
  font-weight: 750;
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
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-xs);
  text-align: center;
  box-sizing: border-box;
}

.activity-stat-joined {
  background: var(--neo-color-success);
  color: var(--neo-color-text);
}

.activity-stat-leave {
  background: var(--neo-color-warning-soft);
  color: var(--neo-color-text);
}

.activity-stat-unchecked {
  background: var(--neo-color-danger-soft);
  color: var(--neo-color-text);
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
  border: 2rpx solid var(--neo-color-text);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  overflow: hidden;
}

.activity-member-row {
  min-height: 82rpx;
  padding: 12rpx 14rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  border-bottom: 2rpx solid var(--neo-color-track);
  box-sizing: border-box;
}

.activity-member-row:last-child {
  border-bottom: 0;
}

.activity-member-avatar {
  width: 54rpx;
  height: 54rpx;
  border: 2rpx solid var(--neo-color-text);
  border-radius: var(--neo-radius-xs);
  flex-shrink: 0;
  overflow: hidden;
  background: var(--neo-color-muted);
}

.activity-member-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--neo-color-text);
  font-size: 22rpx;
  font-weight: 950;
}

.activity-member-copy {
  min-width: 0;
  flex: 1;
}

.activity-member-name {
  display: block;
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-member-meta {
  display: block;
  margin-top: 4rpx;
  color: var(--neo-color-text-muted);
  font-size: 19rpx;
  font-weight: 750;
}

.activity-member-status {
  min-width: 84rpx;
  height: 42rpx;
  padding: 0 14rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 21rpx;
  font-weight: 950;
  box-sizing: border-box;
  flex-shrink: 0;
}

.activity-member-status-joined {
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
}

.activity-member-status-leave {
  background: var(--neo-color-warning-soft);
  color: var(--neo-color-text);
}

.activity-member-status-unchecked {
  background: var(--neo-color-danger);
  color: var(--neo-color-text);
}
</style>
