<script setup lang="ts">
import { computed } from "vue";
import { useAccentTheme } from "@/stores/theme";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import MemberAttendancePopup from "./components/MemberAttendancePopup.vue";
import MemberEditPopup from "./components/MemberEditPopup.vue";
import TeamActivityAttendancePanel from "./components/TeamActivityAttendancePanel.vue";
import TeamDissolvePanel from "./components/TeamDissolvePanel.vue";
import TeamJoinPasswordPanel from "./components/TeamJoinPasswordPanel.vue";
import TeamMemberManager from "./components/TeamMemberManager.vue";
import TeamProfilePanel from "./components/TeamProfilePanel.vue";
import { attendanceStatusClass } from "./teamManageState";
import { useTeamManagePage } from "./useTeamManagePage";

const {
  currentTeam,
  activeMode,
  isManagementBlocked,
  canManageCurrentTeam,
  canShowCreateTeamEntry,
  submitting,
  heroTitle,
  heroCopy,
  pageStyle,
  modeOptions,
  teamProfileForm,
  isUploadingLogo,
  canUpdateTeamProfile,
  joinPasswordForm,
  requiresPassword,
  canSubmitJoinPassword,
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
  activityMatches,
  expandedActivityId,
  matchAttendanceById,
  toggleActivityMatch,
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
  goCreateTeam,
  goJoinTeam,
  handleUpdateTeamProfile,
  handleUploadTeamLogo,
  handleUpdateJoinPassword,
  handleClearJoinPassword,
  joinPasswordDialogVisible,
  joinPasswordDialogState,
  handleJoinPasswordPrimary,
  handleJoinPasswordSecondary,
  handleJoinPasswordClose,
  canDissolveTeam,
  dissolveDialogVisible,
  dissolveDialogState,
  handleDissolveTeam,
  handleDissolvePrimary,
  handleDissolveSecondary,
  handleDissolveClose,
  handleDissolveLinkItem,
  handleEditMember,
  handleSearchUsers,
  handleCandidateTap,
  handleAddMember,
  handleUpdateMember,
  handleRemoveMember,
  handleToggleMemberStatus,
  handleOpenMemberAttendance,
} = useTeamManagePage();

function handleGoBack() {
  uni.navigateBack({ delta: 1 });
}

// page-meta：主题变量覆盖 + 出勤弹窗打开时锁定滚动。
const { themePageStyle } = useAccentTheme();
const metaPageStyle = computed(() =>
  [themePageStyle.value, attendancePopupVisible.value ? "overflow: hidden;" : ""].filter(Boolean).join(";"),
);
</script>

<template>
  <page-meta :page-style="metaPageStyle" />
  <view class="app-theme-scope team-manage-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader title="球队管理" showBack />

    <view class="team-manage-content">
      <!-- mp-weixin 陷阱：不能用 custom-class + 父级 scoped 给子组件根节点做布局（样式隔离挡住，
           布局退化为纵向堆叠）。AppSurface 只承担表面皮肤，横排布局放在页面自己模板的包裹 view 上。 -->
      <AppSurface variant="outlined" flush class="team-manage-hero-surface">
        <view class="team-manage-hero">
          <view class="team-manage-hero__copy">
            <text class="team-manage-title">{{ heroTitle }}</text>
            <text class="team-manage-copy">{{ heroCopy }}</text>
          </view>
          <view class="team-manage-hero__mark">
            <image
              v-if="currentTeam?.logoUrl"
              class="team-manage-hero__logo"
              :src="currentTeam.logoUrl"
              mode="aspectFill"
            />
            <text v-else>{{ currentTeam?.name?.slice(0, 1) || "队" }}</text>
          </view>
        </view>
      </AppSurface>

      <template v-if="canManageCurrentTeam">
        <SegmentedControl
          :model-value="activeMode"
          :options="modeOptions"
          @change="handleModeChange"
        />

        <view v-if="activeMode === 'profile'" class="team-profile-sections">
          <TeamProfilePanel
            :current-team="currentTeam"
            :can-manage-members="canManageMembers"
            :form="teamProfileForm"
            :can-update="canUpdateTeamProfile"
            :submitting="submitting"
            :uploading-logo="isUploadingLogo"
            @submit="handleUpdateTeamProfile"
            @upload-logo="handleUploadTeamLogo"
          />

          <TeamJoinPasswordPanel
            v-if="canManageMembers"
            :requires-password="requiresPassword"
            :form="joinPasswordForm"
            :can-submit="canSubmitJoinPassword"
            :submitting="submitting"
            @submit="handleUpdateJoinPassword"
            @clear="handleClearJoinPassword"
          />

          <TeamDissolvePanel
            v-if="canDissolveTeam"
            :submitting="submitting"
            @dissolve="handleDissolveTeam"
          />
        </view>

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
          :matches="activityMatches"
          :expanded-activity-id="expandedActivityId"
          :match-attendance-by-id="matchAttendanceById"
          :format-attendance-date="formatAttendanceDate"
          @toggle-activity="toggleActivityMatch"
        />
      </template>

      <AppSurface v-else-if="isManagementBlocked" variant="outlined">
        <view class="manage-blocked">
          <text class="manage-blocked__title">暂无管理权限</text>
          <text class="manage-blocked__copy">只有队长或领队可以管理球队，普通队员可在球队主页查看球队信息。</text>
          <AppButton variant="outline" block @click="handleGoBack">返回上一页</AppButton>
        </view>
      </AppSurface>

      <AppSurface v-else variant="outlined">
        <view class="manage-blocked">
          <text class="manage-blocked__title">还没有球队</text>
          <text class="manage-blocked__copy">创建一支球队成为队长，或搜索加入现有球队后再回来管理。</text>
          <AppButton icon="plus" v-if="canShowCreateTeamEntry" variant="lime" block @click="goCreateTeam">创建球队</AppButton>
          <AppButton icon="user-add" variant="outline" block @click="goJoinTeam">加入球队</AppButton>
        </view>
      </AppSurface>
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

    <ConfirmDialog
      :visible="joinPasswordDialogVisible"
      :title="joinPasswordDialogState.title"
      :message="joinPasswordDialogState.message"
      :highlight="joinPasswordDialogState.highlight"
      :primary-text="joinPasswordDialogState.primaryText"
      :secondary-text="joinPasswordDialogState.secondaryText"
      :primary-tone="joinPasswordDialogState.primaryTone"
      @primary="handleJoinPasswordPrimary"
      @secondary="handleJoinPasswordSecondary"
      @close="handleJoinPasswordClose"
    />

    <ConfirmDialog
      :visible="dissolveDialogVisible"
      :title="dissolveDialogState.title"
      :message="dissolveDialogState.message"
      :highlight="dissolveDialogState.highlight"
      :link-items="dissolveDialogState.links"
      :image-src="dissolveDialogState.imageSrc"
      :primary-text="dissolveDialogState.primaryText"
      :secondary-text="dissolveDialogState.secondaryText"
      :primary-tone="dissolveDialogState.primaryTone"
      @primary="handleDissolvePrimary"
      @secondary="handleDissolveSecondary"
      @close="handleDissolveClose"
      @link-item="handleDissolveLinkItem"
    />
  </view>
</template>

<style scoped>
.team-profile-sections {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 20rpx;
}

.team-manage-page {
  min-height: 100vh;
  padding: 0 28rpx 112rpx;
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.team-manage-content {
  width: 100%;
  max-width: 900rpx;
  margin: 0 auto;
  box-sizing: border-box;
}

/* 宿主节点只承担外边距；横排布局与内边距在包裹 view 上（mp 样式隔离安全）。 */
.team-manage-hero-surface {
  margin: 0 0 20rpx;
}

.team-manage-hero {
  display: flex;
  align-items: center;
  gap: 22rpx;

  padding: 24rpx;
}

.team-manage-hero__copy {
  flex: 1;
  min-width: 0;
}

.team-manage-title {
  display: block;

  color: var(--ui-color-text);

  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.18;
  word-break: break-word;
}

.team-manage-copy {
  display: block;

  margin-top: 8rpx;

  color: var(--ui-color-text-muted);

  font-size: 22rpx;
  font-weight: 400;
  line-height: 1.55;
}

.team-manage-hero__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  width: 72rpx;

  height: 72rpx;

  border: 0;
  border-radius: var(--ui-radius-button);

  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text);
  font-size: 40rpx;
  font-weight: 600;
  box-sizing: border-box;
  overflow: hidden;
}

.team-manage-hero__logo {
  width: 100%;
  height: 100%;
}

:deep(.ui-segmented-control) {
  margin-bottom: 24rpx;
}

.manage-blocked {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.manage-blocked__title {
  color: var(--ui-color-text);
  font-size: 30rpx;
  font-weight: 600;
}

.manage-blocked__copy {
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 400;
  line-height: 1.55;
}

@media (max-width: 560rpx) {
  .team-manage-hero__mark {
    width: 88rpx;
    height: 88rpx;
    font-size: 34rpx;
  }
}
</style>
