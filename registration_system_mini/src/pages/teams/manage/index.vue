<script setup lang="ts">
import AppTabHeader from "@/components/AppTabHeader.vue";
import { NeoSegmentedControl, NeoSurface } from "@/components/neo";
import MemberAttendancePopup from "./components/MemberAttendancePopup.vue";
import MemberEditPopup from "./components/MemberEditPopup.vue";
import TeamActivityAttendancePanel from "./components/TeamActivityAttendancePanel.vue";
import TeamCreatePanel from "./components/TeamCreatePanel.vue";
import TeamJoinPanel from "./components/TeamJoinPanel.vue";
import TeamMemberManager from "./components/TeamMemberManager.vue";
import TeamProfilePanel from "./components/TeamProfilePanel.vue";
import { attendanceStatusClass } from "./teamManageState";
import { useTeamManagePage } from "./useTeamManagePage";

const {
  currentTeam,
  activeMode,
  submitting,
  searching,
  searchKeyword,
  searchResults,
  selectedTeam,
  selectedTeamRequiresPassword,
  joinPassword,
  createForm,
  canCreate,
  canJoin,
  heroTitle,
  heroCopy,
  pageStyle,
  modeOptions,
  createTeamReviewMode,
  reviewTeamNameOptions,
  teamProfileForm,
  logoUploading,
  canUpdateTeamProfile,
  canManageMembers,
  userSearching,
  userSearchKeyword,
  userSearchResults,
  selectedCandidate,
  editMemberPopupVisible,
  memberForm,
  editMemberForm,
  editingMember,
  leadershipMembers,
  regularMembers,
  frozenMembers,
  attendancePopupVisible,
  attendanceLoading,
  attendanceRecords,
  attendanceMember,
  attendanceSummary,
  attendanceGroups,
  activityAttendanceLoading,
  activityAttendanceSummaries,
  memberName,
  memberAvatarUrl,
  memberInitial,
  attendanceStatusLabel,
  formatAttendanceDate,
  isCurrentMember,
  isCaptainMember,
  candidateActionLabel,
  toggleAttendanceYear,
  closeAttendancePopup,
  closeEditMemberPopup,
  handleModeChange,
  handleCreateTeam,
  handleSearchTeams,
  handleSelectTeam,
  handleJoinTeam,
  handleChooseTeamLogo,
  handleUpdateTeamProfile,
  handleEditMember,
  handleSearchUsers,
  handleCandidateTap,
  handleAddMember,
  handleUpdateMember,
  handleRemoveMember,
  handleToggleMemberStatus,
  handleOpenMemberAttendance,
} = useTeamManagePage();
</script>

<template>
  <page-meta :page-style="attendancePopupVisible ? 'overflow: hidden;' : ''" />
  <view class="team-manage-page" :style="pageStyle">
    <AppTabHeader title="球队管理" showBack />

    <view class="team-manage-content">
      <NeoSurface variant="dark" custom-class="team-manage-hero">
        <view class="team-manage-hero__copy">
          <text class="team-manage-title">{{ heroTitle }}</text>
          <text class="team-manage-copy">{{ heroCopy }}</text>
        </view>
        <view class="team-manage-hero__mark">
          <text>{{ currentTeam?.name?.slice(0, 1) || "队" }}</text>
        </view>
      </NeoSurface>

      <NeoSegmentedControl
        :model-value="activeMode"
        :options="modeOptions"
        @change="handleModeChange"
      />

      <TeamProfilePanel
      v-if="activeMode === 'profile'"
      :current-team="currentTeam"
      :can-manage-members="canManageMembers"
      :form="teamProfileForm"
      :logo-uploading="logoUploading"
      :can-update="canUpdateTeamProfile"
      :submitting="submitting"
      @choose-logo="handleChooseTeamLogo"
      @submit="handleUpdateTeamProfile"
      />

      <TeamCreatePanel
      v-else-if="activeMode === 'create'"
      :form="createForm"
      :review-mode="createTeamReviewMode"
      :review-team-name-options="reviewTeamNameOptions"
      :can-create="canCreate"
      :submitting="submitting"
      @submit="handleCreateTeam"
      />

      <TeamJoinPanel
      v-else-if="activeMode === 'join'"
      v-model:search-keyword="searchKeyword"
      v-model:join-password="joinPassword"
      :searching="searching"
      :search-results="searchResults"
      :selected-team="selectedTeam"
      :selected-team-requires-password="selectedTeamRequiresPassword"
      :can-join="canJoin"
      :submitting="submitting"
      @search="handleSearchTeams"
      @select-team="handleSelectTeam"
      @join="handleJoinTeam"
      />

      <TeamMemberManager
      v-else-if="activeMode === 'members'"
      :current-team="currentTeam"
      :can-manage-members="canManageMembers"
      v-model:user-search-keyword="userSearchKeyword"
      :user-searching="userSearching"
      :user-search-results="userSearchResults"
      :selected-candidate="selectedCandidate"
      :member-form="memberForm"
      :leadership-members="leadershipMembers"
      :regular-members="regularMembers"
      :frozen-members="frozenMembers"
      :submitting="submitting"
      :member-name="memberName"
      :member-avatar-url="memberAvatarUrl"
      :member-initial="memberInitial"
      :is-current-member="isCurrentMember"
      :is-captain-member="isCaptainMember"
      :candidate-action-label="candidateActionLabel"
      @search-users="handleSearchUsers"
      @candidate-tap="handleCandidateTap"
      @add-member="handleAddMember"
      @open-member-attendance="handleOpenMemberAttendance"
      @edit-member="handleEditMember"
      @toggle-member-status="handleToggleMemberStatus"
      @remove-member="handleRemoveMember"
      />

      <TeamActivityAttendancePanel
      v-else-if="activeMode === 'attendance'"
      :current-team="currentTeam"
      :loading="activityAttendanceLoading"
      :summaries="activityAttendanceSummaries"
      :format-attendance-date="formatAttendanceDate"
      />
    </view>

    <MemberEditPopup
      v-model="editMemberPopupVisible"
      :member="editingMember"
      :member-name="editingMember ? memberName(editingMember.user_id) : '队员'"
      :form="editMemberForm"
      :submitting="submitting"
      @close="closeEditMemberPopup"
      @submit="handleUpdateMember"
    />

    <MemberAttendancePopup
      v-model="attendancePopupVisible"
      :member="attendanceMember"
      :member-name="attendanceMember ? memberName(attendanceMember.user_id) : '队员'"
      :member-avatar-url="attendanceMember ? memberAvatarUrl(attendanceMember.user_id) : ''"
      :member-initial="attendanceMember ? memberInitial(attendanceMember.user_id) : '队'"
      :loading="attendanceLoading"
      :records="attendanceRecords"
      :summary="attendanceSummary"
      :groups="attendanceGroups"
      :format-attendance-date="formatAttendanceDate"
      :attendance-status-class="attendanceStatusClass"
      :attendance-status-label="attendanceStatusLabel"
      @close="closeAttendancePopup"
      @toggle-year="toggleAttendanceYear"
    />
  </view>
</template>

<style scoped>
.team-manage-page {
  min-height: 100vh;
  padding: 0 28rpx 112rpx;
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.team-manage-content {
  width: 100%;
  max-width: 900rpx;
  margin: 0 auto;
  box-sizing: border-box;
}

.team-manage-hero {
  display: flex;
  align-items: center;
  gap: 22rpx;
  margin: 22rpx 0 24rpx;
  padding: 28rpx 26rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-hero);
  box-shadow: 8rpx 8rpx 0 var(--neo-color-accent);
}

.team-manage-hero__copy {
  flex: 1;
  min-width: 0;
}

.team-manage-title {
  display: block;
  color: var(--neo-color-text-inverse);
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1.18;
  word-break: break-word;
}

.team-manage-copy {
  display: block;
  margin-top: 12rpx;
  color: rgba(255, 255, 255, 0.72);
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.55;
}

.team-manage-hero__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 104rpx;
  height: 104rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  font-size: 40rpx;
  font-weight: 900;
  box-sizing: border-box;
}

:deep(.neo-segmented-control) {
  margin-bottom: 24rpx;
}

@media (max-width: 560rpx) {
  .team-manage-hero__mark {
    width: 88rpx;
    height: 88rpx;
    font-size: 34rpx;
  }
}
</style>
