<script setup lang="ts">
import { computed, ref } from "vue";
import { NeoButton, NeoSectionHeader, NeoSurface } from "@/components/neo";
import type { BackendTeamMember, BackendUser } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { memberRoleOptions, roleLabel } from "../teamManageState";
import MemberCandidateSearch from "./MemberCandidateSearch.vue";
import TeamMemberSection from "./TeamMemberSection.vue";

const props = defineProps<{
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
    isMember: boolean;
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

function handleMemberSwitchChange(event: Event) {
  const detail = (event as unknown as { detail?: { value?: boolean } }).detail;
  props.memberForm.isMember = !!detail?.value;
}

const roleModel = computed({
  get: () => [props.memberForm.role],
  set: (value) => {
    props.memberForm.role = String(value[0] || "member");
  },
});
const rolePickerVisible = ref(false);

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
  <NeoSurface custom-class="form-card">
    <NeoSectionHeader title="队员管理" marker="01" caption="添加队员、调整角色并查看个人出勤" />
    <view v-if="!currentTeam" class="empty-box">请先创建或加入球队。</view>
    <view v-else-if="!canManageMembers" class="empty-box">只有队长或领队可以管理队员。</view>
    <view v-else>
      <view class="member-create-panel">
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
        <wd-cell
          title="队员角色"
          :value="roleLabel(memberForm.role)"
          is-link
          clickable
          custom-class="member-role-cell"
          custom-title-class="member-role-cell-title"
          custom-value-class="member-role-cell-value"
          @click="rolePickerVisible = true"
        />
        <wd-picker
          v-model="roleModel"
          v-model:visible="rolePickerVisible"
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
        <view class="member-setting-row">
          <view>
            <text class="member-setting-title">队员会员</text>
            <text class="member-setting-copy">用于在队员信息中区分会员身份</text>
          </view>
          <switch :checked="memberForm.isMember" color="#b9f24b" @change="handleMemberSwitchChange" />
        </view>
        <NeoButton block :loading="submitting" @click="handleAddMember">
          {{ submitting ? "提交中..." : "添加队员" }}
        </NeoButton>
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
  </NeoSurface>
</template>

<style scoped>
.form-card {
  padding: 6rpx 24rpx 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  box-shadow: 8rpx 8rpx 0 var(--neo-color-text);
}

.form-label {
  color: var(--neo-color-text);
  font-size: 24rpx;
  display: block;
  font-weight: 900;
}

.member-create-panel {
  margin-top: 26rpx;
  padding: 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-info-soft);
}

.form-input {
  width: 100%;
  height: 84rpx;
  margin-top: 12rpx;
  padding: 0 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.empty-box {
  margin-top: 26rpx;
  padding: 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-warning-soft);
  color: var(--neo-color-text-muted);
  font-size: 26rpx;
  font-weight: 700;
}

.member-role-picker {
  width: 100%;
  display: block;
  margin-top: 14rpx;
}

:deep(.member-role-picker) {
  --wot-picker-bg: var(--neo-color-surface);
  --wot-picker-action-color-confirm: var(--neo-color-text);
  --wot-picker-action-color-cancel: var(--neo-color-text-muted);
  --wot-picker-action-disabled-color: var(--neo-color-text-disabled);
  --wot-picker-title-color: var(--neo-color-text);
  --wot-picker-title-font-weight: 900;
  --wot-picker-radius: var(--neo-radius-md);
}

:deep(.member-role-cell) {
  margin-top: 14rpx;
  padding: 0 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  box-sizing: border-box;
}

:deep(.member-role-cell-title) {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 900;
}

:deep(.member-role-cell-value) {
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 900;
}

:deep(.member-role-picker-cell) {
  width: 100%;
  height: 84rpx;
  padding: 0 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  box-sizing: border-box;
}

:deep(.member-role-picker-value) {
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 900;
}

.member-setting-row {
  min-height: 88rpx;
  margin: 12rpx 0 16rpx;
  padding: 16rpx 18rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-warning-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  box-sizing: border-box;
}

.member-setting-title,
.member-setting-copy {
  display: block;
}

.member-setting-title {
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 900;
}

.member-setting-copy {
  margin-top: 4rpx;
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
}

:deep(.member-create-panel .neo-button--block) {
  margin-top: 4rpx;
}
</style>
