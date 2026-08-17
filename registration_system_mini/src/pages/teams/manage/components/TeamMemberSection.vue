<script setup lang="ts">
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
  <view class="member-section">
    <view class="member-section-header">
      <text class="member-section-title">{{ title }}</text>
      <text class="member-section-count">{{ members.length }} 人</text>
    </view>
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
          <view class="member-link" hover-class="member-link-pressed" @tap.stop="handleEditMember(member)">编辑</view>
          <view class="member-link" hover-class="member-link-pressed" @tap.stop="handleToggleMemberStatus(member)">{{ toggleLabel(member) }}</view>
          <view v-if="member.role !== 'captain'" class="member-link member-link-danger" hover-class="member-link-pressed" @tap.stop="handleRemoveMember(member)">移除</view>
        </view>
      </view>
    </view>
    <view v-else class="empty-box member-section-empty">{{ emptyText }}</view>
  </view>
</template>

<style scoped>
.member-section {
  margin-top: 30rpx;
}

.member-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.member-section-title {
  color: #10110f;
  font-size: 30rpx;
  font-weight: 900;
}

.member-section-count {
  min-width: 88rpx;
  height: 46rpx;
  padding: 0 18rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-xs);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.team-result-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 22rpx;
}

.member-section-list {
  margin-top: 14rpx;
}

.empty-box {
  margin-top: 22rpx;
  padding: 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  color: var(--neo-color-text-muted);
  font-size: 26rpx;
  font-weight: 700;
}

.member-section-empty {
  margin-top: 14rpx;
}

.member-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 18rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  box-shadow: 4rpx 4rpx 0 var(--neo-color-text);
  box-sizing: border-box;
}

.member-card-main {
  display: flex;
  align-items: center;
  gap: 16rpx;
  width: 100%;
}

.member-card-leadership {
  background: var(--neo-color-success);
}

.member-card-frozen {
  background: var(--neo-color-muted);
  opacity: 0.86;
}

.member-avatar {
  width: 76rpx;
  height: 76rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  flex-shrink: 0;
  overflow: hidden;
  background: var(--neo-color-text);
}

.member-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--neo-color-accent);
  font-size: 30rpx;
  font-weight: 900;
}

.member-avatar-muted {
  filter: grayscale(1);
  opacity: 0.68;
}

.member-main {
  flex: 1;
  min-width: 0;
}

.member-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}

.member-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-result-title {
  display: block;
  color: var(--neo-color-text);
  font-size: 30rpx;
  font-weight: 900;
}

.team-result-meta {
  display: block;
  margin-top: 6rpx;
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 700;
}

.member-role-badge {
  flex-shrink: 0;
  height: 42rpx;
  padding: 0 16rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-xs);
  background: var(--neo-color-text);
  color: var(--neo-color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.member-role-badge-muted {
  background: var(--neo-color-disabled);
  color: var(--neo-color-text-muted);
}


.member-actions {
  display: flex;
  gap: 10rpx;
  width: 100%;
}

.member-link {
  flex: 1;
  min-width: 0;
  height: 54rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-xs);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
  line-height: 1;
  box-shadow: 2rpx 2rpx 0 var(--neo-color-text);
  box-sizing: border-box;
}

.member-link-danger {
  background: var(--neo-color-danger-soft);
}

.member-link-pressed {
  transform: translate(2rpx, 2rpx);
  box-shadow: none;
}
</style>
