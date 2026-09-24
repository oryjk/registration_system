<script setup lang="ts">
import TeamManagePanel from "./TeamManagePanel.vue";
import type { BackendTeamMember } from "@/types/backend";
import { isLeadershipRole, memberStatusLabel, roleLabel } from "../teamManageState";

const props = withDefaults(
  defineProps<{
    title: string;
    emptyText: string;
    members: BackendTeamMember[];
    variant?: "leadership" | "regular" | "frozen";
    memberName: (userId: number) => string;
    memberAvatarUrl: (userId: number) => string;
    memberInitial: (userId: number) => string;
  }>(),
  {
    variant: "regular",
  },
);

const emit = defineEmits<{
  (event: "openMemberAttendance", member: BackendTeamMember): void;
  (event: "editMember", member: BackendTeamMember): void;
  (event: "toggleMemberStatus", member: BackendTeamMember): void;
  (event: "removeMember", member: BackendTeamMember): void;
}>();

function memberCardClass(member: BackendTeamMember) {
  return [
    "member-card",
    props.variant === "leadership" ? "member-card-leadership" : "",
    props.variant === "frozen" || member.status !== 1 ? "member-card-frozen" : "",
  ];
}

function showRoleBadge(member: BackendTeamMember) {
  return props.variant === "leadership" || (props.variant === "frozen" && isLeadershipRole(member.role));
}

function roleBadgeClass() {
  return ["member-role-badge", props.variant === "frozen" ? "member-role-badge-muted" : ""];
}

function statusMeta(member: BackendTeamMember) {
  // Go 队员模型只有 role/status，不再展示球衣号与会员身份。
  if (props.variant === "regular") {
    return `${roleLabel(member.role)} · ${memberStatusLabel(member.status)}`;
  }
  return memberStatusLabel(member.status);
}

function toggleLabel(member: BackendTeamMember) {
  return member.status === 1 ? "冻结" : "恢复";
}

function handleOpenMemberAttendance(member: BackendTeamMember) {
  emit("openMemberAttendance", member);
}

function handleEditMember(member: BackendTeamMember) {
  emit("editMember", member);
}

function handleToggleMemberStatus(member: BackendTeamMember) {
  emit("toggleMemberStatus", member);
}

function handleRemoveMember(member: BackendTeamMember) {
  emit("removeMember", member);
}
</script>

<template>
  <TeamManagePanel :title="title">
    <template #accessory><text class="member-section-count">{{ members.length }} 人</text></template>
    <view v-if="members.length" class="team-result-list member-section-list">
      <view v-for="member in members" :key="member.user_id" :class="memberCardClass(member)" @tap="handleOpenMemberAttendance(member)">
        <view class="member-card-main">
          <image
            v-if="memberAvatarUrl(member.user_id)"
            :class="['member-avatar', variant === 'frozen' ? 'member-avatar-muted' : '']"
            :src="memberAvatarUrl(member.user_id)"
            mode="aspectFill"
          />
          <view v-else :class="['member-avatar', 'member-avatar-fallback', variant === 'frozen' ? 'member-avatar-muted' : '']">
            {{ memberInitial(member.user_id) }}
          </view>
          <view class="member-main">
            <view class="member-title-row">
              <text class="team-result-title member-name">{{ memberName(member.user_id) }}</text>
              <text v-if="showRoleBadge(member)" :class="roleBadgeClass()">{{ roleLabel(member.role) }}</text>
            </view>
            <text class="team-result-meta">{{ statusMeta(member) }}</text>
          </view>
        </view>
        <view class="member-actions">
          <view class="member-link" role="button" hover-class="member-link-pressed" @tap.stop="handleOpenMemberAttendance(member)">
            <wd-icon name="calendar-line" size="26rpx" /><text>出勤</text>
          </view>
          <view class="member-link" role="button" hover-class="member-link-pressed" @tap.stop="handleEditMember(member)">
            <wd-icon name="edit" size="26rpx" /><text>编辑</text>
          </view>
          <view class="member-link" role="button" hover-class="member-link-pressed" @tap.stop="handleToggleMemberStatus(member)">
            <wd-icon :name="member.status === 1 ? 'lock' : 'unlock'" size="26rpx" /><text>{{ toggleLabel(member) }}</text>
          </view>
          <view v-if="member.role !== 'captain'" class="member-link member-link-danger" role="button" hover-class="member-link-pressed" @tap.stop="handleRemoveMember(member)">
            <wd-icon name="delete" size="26rpx" /><text>移除</text>
          </view>
        </view>
      </view>
    </view>
    <view v-else class="empty-box member-section-empty">{{ emptyText }}</view>
  </TeamManagePanel>
</template>

<style scoped>
.member-section-count { flex-shrink: 0; padding: 6rpx 14rpx; border-radius: var(--ui-radius-round); background: var(--ui-color-neutral-bg); color: var(--ui-color-neutral-fg); font-size: 22rpx; font-variant-numeric: tabular-nums; }
.member-card { padding: 16rpx 0; border-top: var(--ui-border-default); }
.member-card:first-child { padding-top: 0; border-top: 0; }
.member-card:last-child { padding-bottom: 0; }
.member-card-main { display: flex; align-items: center; gap: 16rpx; min-height: 68rpx; }
.member-avatar { width: 68rpx; height: 68rpx; border-radius: var(--ui-radius-round); flex-shrink: 0; overflow: hidden; background: var(--ui-color-neutral-bg); }
.member-avatar-fallback { display: flex; align-items: center; justify-content: center; color: var(--ui-color-text); font-size: 30rpx; font-weight: 600; }
.member-avatar-muted { filter: grayscale(1); }
.member-main { flex: 1; min-width: 0; }
.member-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx 12rpx; }
.member-name { color: var(--ui-color-text); font-size: 28rpx; font-weight: 600; line-height: 1.5; overflow-wrap: anywhere; }
.team-result-meta { display: block; margin-top: 4rpx; color: var(--ui-color-text-muted); font-size: 22rpx; line-height: 1.5; }
.member-role-badge { padding: 4rpx 12rpx; border-radius: var(--ui-radius-round); background: var(--ui-color-accent-soft); color: var(--ui-color-accent-deep); font-size: 22rpx; font-weight: 500; }
.member-role-badge-muted { background: var(--ui-color-neutral-bg); color: var(--ui-color-neutral-fg); }
.member-actions { display: flex; gap: 10rpx; margin-top: 12rpx; }
.member-link { flex: 1; min-width: 0; min-height: 64rpx; padding: 8rpx; display: flex; align-items: center; justify-content: center; gap: 6rpx; white-space: nowrap; border-radius: var(--ui-radius-round); background: var(--ui-color-neutral-bg); color: var(--ui-color-neutral-fg); font-size: 24rpx; line-height: 1.5; box-sizing: border-box; }
.member-link-danger { background: var(--ui-color-danger-bg); color: var(--ui-color-danger-fg); }
.member-link-pressed { opacity: 0.7; }
.empty-box { padding: 16rpx 0; color: var(--ui-color-text-muted); font-size: 24rpx; line-height: 1.6; }
</style>
