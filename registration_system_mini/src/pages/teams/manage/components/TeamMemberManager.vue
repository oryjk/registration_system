<script setup lang="ts">
import type { BackendTeamMember, BackendUser } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { memberRoleOptions } from "../teamManageState";
import MemberCandidateSearch from "./MemberCandidateSearch.vue";
import TeamMemberSection from "./TeamMemberSection.vue";

defineProps<{
  currentTeam: TeamProfileViewModel | null;
  canManageMembers: boolean;
  userSearchKeyword: string;
  userSearching: boolean;
  userSearchResults: BackendUser[];
  selectedCandidate: BackendUser | null;
  memberForm: {
    userId: string;
    role: string;
    jerseyNumber: string;
  };
  leadershipMembers: BackendTeamMember[];
  regularMembers: BackendTeamMember[];
  frozenMembers: BackendTeamMember[];
  submitting: boolean;
  memberName: (userId: number) => string;
  memberAvatarUrl: (userId: number) => string;
  memberInitial: (userId: number) => string;
  isCurrentMember: (userId: number) => boolean;
  isCaptainMember: (userId: number) => boolean;
  candidateActionLabel: (candidate: BackendUser) => string;
}>();

const emit = defineEmits<{
  (event: "update:userSearchKeyword", value: string): void;
  (event: "searchUsers"): void;
  (event: "candidateTap", candidate: BackendUser): void;
  (event: "addMember"): void;
  (event: "openMemberAttendance", member: BackendTeamMember): void;
  (event: "editMember", member: BackendTeamMember): void;
  (event: "toggleMemberStatus", member: BackendTeamMember): void;
  (event: "removeMember", member: BackendTeamMember): void;
}>();

function handleSearchUsers() {
  emit("searchUsers");
}

function handleCandidateTap(candidate: BackendUser) {
  emit("candidateTap", candidate);
}

function handleAddMember() {
  emit("addMember");
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
  <view class="form-card">
    <text class="form-title">队员管理</text>
    <view v-if="!currentTeam" class="empty-box">请先创建或加入球队。</view>
    <view v-else-if="!canManageMembers" class="empty-box">只有队长或领队可以管理队员。</view>
    <view v-else>
      <text class="form-label">添加队员</text>
      <MemberCandidateSearch
        :user-search-keyword="userSearchKeyword"
        :user-searching="userSearching"
        :user-search-results="userSearchResults"
        :selected-candidate="selectedCandidate"
        :is-current-member="isCurrentMember"
        :is-captain-member="isCaptainMember"
        :candidate-action-label="candidateActionLabel"
        @update:user-search-keyword="emit('update:userSearchKeyword', $event)"
        @search-users="handleSearchUsers"
        @candidate-tap="handleCandidateTap"
      />
      <wd-picker
        v-model="memberForm.role"
        title="选择角色"
        placeholder="请选择角色"
        :columns="memberRoleOptions"
        value-key="value"
        label-key="label"
        confirm-button-text="确定"
        cancel-button-text="取消"
        custom-class="member-role-picker"
        custom-cell-class="member-role-picker-cell"
        custom-value-class="member-role-picker-value"
      />

      <input v-model="memberForm.jerseyNumber" class="form-input" placeholder="球衣号，可选" />
      <view class="member-action-row">
        <view class="primary-button member-submit" @tap="handleAddMember">
          {{ submitting ? "提交中..." : "添加队员" }}
        </view>
      </view>

      <TeamMemberSection
        title="管理角色"
        empty-text="暂未设置队长、领队或队务。"
        variant="leadership"
        :members="leadershipMembers"
        :member-name="memberName"
        :member-avatar-url="memberAvatarUrl"
        :member-initial="memberInitial"
        @open-member-attendance="handleOpenMemberAttendance"
        @edit-member="handleEditMember"
        @toggle-member-status="handleToggleMemberStatus"
        @remove-member="handleRemoveMember"
      />

      <TeamMemberSection
        title="普通队员"
        empty-text="暂无普通队员。"
        :members="regularMembers"
        :member-name="memberName"
        :member-avatar-url="memberAvatarUrl"
        :member-initial="memberInitial"
        @open-member-attendance="handleOpenMemberAttendance"
        @edit-member="handleEditMember"
        @toggle-member-status="handleToggleMemberStatus"
        @remove-member="handleRemoveMember"
      />

      <TeamMemberSection
        title="冻结队员"
        empty-text="暂无冻结队员。"
        variant="frozen"
        :members="frozenMembers"
        :member-name="memberName"
        :member-avatar-url="memberAvatarUrl"
        :member-initial="memberInitial"
        @open-member-attendance="handleOpenMemberAttendance"
        @edit-member="handleEditMember"
        @toggle-member-status="handleToggleMemberStatus"
        @remove-member="handleRemoveMember"
      />
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
  margin-bottom: 24rpx;
  color: #10110f;
  font-size: 34rpx;
  font-weight: 900;
}

.form-label,
.team-result-meta {
  color: #6a7165;
  font-size: 24rpx;
  font-weight: 700;
}

.form-label {
  display: block;
  margin-bottom: 10rpx;
}

.form-input {
  width: 100%;
  height: 86rpx;
  padding: 0 22rpx;
  border-radius: 22rpx;
  background: #f3f5ef;
  color: #111310;
  font-size: 28rpx;
  font-weight: 700;
  box-sizing: border-box;
}

.primary-button {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  background: #c8ff00;
  color: #10110f;
  font-size: 28rpx;
  font-weight: 900;
}

.primary-button {
  height: 88rpx;
  margin-top: 28rpx;
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

.member-role-picker {
  width: 100%;
  display: block;
  margin-top: 14rpx;
}

:deep(.member-role-picker-cell) {
  width: 100%;
  height: 86rpx;
  padding: 0 22rpx;
  border-radius: 22rpx;
  background: #f3f5ef;
  color: #111310;
  box-sizing: border-box;
}

:deep(.member-role-picker-value) {
  color: #111310;
  font-size: 28rpx;
  font-weight: 900;
}

.member-action-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.member-submit {
  flex: 1;
}
</style>
