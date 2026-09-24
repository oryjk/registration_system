<script setup lang="ts">
import TeamManagePanel from "./TeamManagePanel.vue";
import RunningLoader from "@/components/ui/RunningLoader.vue";
import SmoothCollapse from "@/components/ui/SmoothCollapse.vue";
import type {
  BackendTeamMemberAttendanceRecord,
  BackendTeamMatchAttendance,
} from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";

interface MatchAttendanceState {
  loading: boolean;
  detail: BackendTeamMatchAttendance | null;
}

defineProps<{
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
  <TeamManagePanel title="队员出勤" caption="按比赛查看队员报名与打卡情况">
    <template #accessory><text v-if="matches.length" class="attendance-total-badge">{{ matches.length }} 场</text></template>
    <view v-if="!currentTeam" class="empty-box">请先创建或加入球队。</view>
    <RunningLoader v-else-if="loading" text="正在加载球队比赛" />
    <view v-else-if="!matches.length" class="empty-box">暂无可展示的球队比赛出勤。</view>
    <view v-else class="activity-attendance-list">
      <view v-for="match in matches" :key="match.activity_id" class="activity-attendance-card">
        <view class="activity-card-topline" role="button" :aria-expanded="expandedActivityId === match.activity_id" hover-class="activity-card-pressed" @tap="emit('toggleActivity', match.activity_id)">
          <view class="activity-card-main">
            <text class="activity-name">{{ match.activity_name }}</text>
            <text class="activity-meta">{{ formatAttendanceDate(match.holding_date) }} · {{ match.location || "地点待定" }}</text>
          </view>
          <text class="activity-expand-arrow" :class="{ 'activity-expand-arrow-open': expandedActivityId === match.activity_id }">›</text>
        </view>
        <SmoothCollapse :visible="expandedActivityId === match.activity_id">
          <view class="activity-detail">
          <RunningLoader v-if="matchAttendanceById[match.activity_id]?.loading" text="正在加载出勤明细" />
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
          </view>
        </SmoothCollapse>
      </view>
    </view>
  </TeamManagePanel>
</template>

<style scoped>
.attendance-total-badge { flex-shrink: 0; padding: 6rpx 14rpx; border-radius: var(--ui-radius-round); background: var(--ui-color-neutral-bg); color: var(--ui-color-neutral-fg); font-size: 22rpx; font-variant-numeric: tabular-nums; }
.empty-box, .activity-loading { padding: 24rpx 0; color: var(--ui-color-text-muted); font-size: 24rpx; line-height: 1.6; }
.activity-attendance-card { border-top: var(--ui-border-default); }
.activity-attendance-card:first-child { border-top: 0; }
.activity-card-topline { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 24rpx 0; min-height: 96rpx; }
.activity-card-pressed { opacity: 0.7; }
.activity-card-main { flex: 1; min-width: 0; }
.activity-name { display: block; color: var(--ui-color-text); font-size: 28rpx; line-height: 1.5; font-weight: 600; overflow-wrap: anywhere; }
.activity-meta { display: block; margin-top: 8rpx; color: var(--ui-color-text-muted); font-size: 22rpx; line-height: 1.6; overflow-wrap: anywhere; }
.activity-expand-arrow { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 64rpx; height: 64rpx; border-radius: var(--ui-radius-round); background: var(--ui-color-accent-soft); color: var(--ui-color-accent-deep); font-size: 36rpx; transition: transform var(--ui-motion-switch-duration) var(--ui-motion-ease-out); }
.activity-expand-arrow-open { transform: rotate(90deg); }
.activity-detail { padding-bottom: 24rpx; }
.activity-stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12rpx; }
.activity-stat { min-width: 0; padding: 20rpx 8rpx; border-radius: var(--ui-radius-button); text-align: center; }
.activity-stat-joined, .activity-member-status-joined { background: var(--ui-color-success-bg); color: var(--ui-color-success-fg); }
.activity-stat-leave, .activity-member-status-leave { background: var(--ui-color-warning-bg); color: var(--ui-color-warning-fg); }
.activity-stat-unchecked, .activity-member-status-unchecked { background: var(--ui-color-neutral-bg); color: var(--ui-color-neutral-fg); }
.activity-stat-value { display: block; font-size: 34rpx; font-weight: 600; line-height: 1.2; font-variant-numeric: tabular-nums; }
.activity-stat-label { display: block; margin-top: 8rpx; font-size: 22rpx; }
.activity-member-list { margin-top: 16rpx; }
.activity-member-row { display: flex; align-items: center; gap: 14rpx; min-height: 88rpx; padding: 16rpx 0; border-bottom: var(--ui-border-default); }
.activity-member-row:last-child { border-bottom: 0; }
.activity-member-avatar { width: 64rpx; height: 64rpx; border-radius: var(--ui-radius-round); flex-shrink: 0; background: var(--ui-color-neutral-bg); }
.activity-member-avatar-fallback { display: flex; align-items: center; justify-content: center; color: var(--ui-color-text); font-size: 26rpx; font-weight: 600; }
.activity-member-copy { min-width: 0; flex: 1; }
.activity-member-name { display: block; color: var(--ui-color-text); font-size: 26rpx; line-height: 1.5; font-weight: 500; overflow-wrap: anywhere; }
.activity-member-meta { display: block; margin-top: 4rpx; color: var(--ui-color-text-muted); font-size: 22rpx; }
.activity-member-status { flex-shrink: 0; padding: 8rpx 14rpx; border-radius: var(--ui-radius-round); font-size: 24rpx; font-weight: 600; }
@media (prefers-reduced-motion: reduce) { .activity-expand-arrow { transition: none; } }
</style>
