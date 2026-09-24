<script setup lang="ts">
import { computed, ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import TeamManagePanel from "./TeamManagePanel.vue";
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
  <view class="member-manager">
  <TeamManagePanel title="添加队员" caption="搜索已注册用户，选择角色后加入球队">
    <view v-if="!currentTeam" class="empty-box">请先创建或加入球队。</view>
    <view v-else-if="!canManageMembers" class="empty-box">只有队长或领队可以管理队员。</view>
    <view v-else>
      <view class="member-create-panel">
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
        <view class="member-role-field" role="button" aria-label="选择队员角色" @tap="rolePickerVisible = true">
          <text class="member-role-label">队员角色</text>
          <text class="member-role-value">{{ roleLabel(memberForm.role) }}</text>
          <text class="member-role-arrow">›</text>
        </view>
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
        <!-- Go 队员模型只有 role/status：球衣号与队员会员开关已随 legacy Rust 字段一起移除。 -->
        <view class="member-add-action">
        <AppButton icon="user-add" block :loading="submitting" @click="handleAddMember">
          {{ submitting ? "提交中..." : "添加队员" }}
        </AppButton>
        </view>
      </view>
    </view>
  </TeamManagePanel>
  <view v-if="currentTeam && canManageMembers" class="member-sections">
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


.member-create-panel { min-width: 0; }
.member-manager, .member-sections { display: flex; flex-direction: column; gap: 24rpx; }
.member-add-action { margin-top: 24rpx; }


.empty-box {
  margin-top: 26rpx;
  padding: 20rpx 0;
  border: none;
  border-radius: var(--ui-radius-button);
  background: transparent;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 400;
}

.member-role-picker {
  width: 100%;
  display: block;
  margin-top: 14rpx;
}

:deep(.member-role-picker) {
  --wot-picker-bg: var(--ui-color-surface);
  --wot-picker-action-color-confirm: var(--ui-color-text);
  --wot-picker-action-color-cancel: var(--ui-color-text-muted);
  --wot-picker-action-disabled-color: var(--ui-color-text-disabled);
  --wot-picker-title-color: var(--ui-color-text);
  --wot-picker-title-font-weight: 600;
  --wot-picker-radius: var(--ui-radius-md);
}




:deep(.member-role-picker-cell) {
  width: 100%;
  height: 84rpx;
  padding: 0 20rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  box-sizing: border-box;
}

:deep(.member-role-picker-value) {
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: 600;
}


.member-role-field { display: flex; align-items: center; gap: 16rpx; min-height: 88rpx; padding: 0 20rpx; margin-top: 16rpx; border: var(--ui-border-default); border-radius: var(--ui-radius-button); background: var(--ui-color-surface); }
.member-role-label { flex: 1; color: var(--ui-color-text-muted); font-size: 24rpx; }
.member-role-value { color: var(--ui-color-text); font-size: 26rpx; }
.member-role-arrow { color: var(--ui-color-text-muted); font-size: 32rpx; }
</style>
