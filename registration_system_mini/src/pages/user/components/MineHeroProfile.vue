<script setup lang="ts">
import type { BackendUser } from "@/types/backend";
import type { CurrentIdentityViewModel, TeamProfileViewModel } from "@/types/viewModels";

const props = defineProps<{
  availableIdentities: CurrentIdentityViewModel[];
  currentIdentity: CurrentIdentityViewModel | null;
  currentUser: BackendUser | null;
  currentTeam: TeamProfileViewModel | null;
  teamProfiles: TeamProfileViewModel[];
  isSwitchingTeam: boolean;
  displayName: string;
  displayHandle: string;
  avatarToken: string;
  teamBadgeLabel: string;
  overviewDigest: {
    activityCount: number;
    teamCount: number;
    totalHoursLabel: string;
  };
  currentTeamJoinedDaysLabel: string;
}>();

const emit = defineEmits<{
  (event: "editProfile"): void;
  (event: "login"): void;
  (event: "logout"): void;
  (event: "switchIdentity", identityId: string): void;
  (event: "switchTeam", teamId: number): void;
}>();

function handleEditProfile() {
  if (!props.currentUser) {
    emit("login");
    return;
  }
  emit("editProfile");
}

function handleLogout() {
  if (!props.currentUser) {
    emit("login");
    return;
  }
  emit("logout");
}

function handleSwitchTeam(teamId: number) {
  emit("switchTeam", teamId);
}

function handleSwitchIdentity(identityId: string) {
  emit("switchIdentity", identityId);
}
</script>

<template>
  <view class="profile-shell">
    <view class="profile-main-row">
      <view class="profile-avatar">
        <image
          v-if="currentUser?.avatar_url"
          class="profile-avatar-image"
          :src="currentUser.avatar_url"
          mode="aspectFill"
        />
        <text v-else>{{ avatarToken }}</text>
      </view>
      <view class="profile-copy">
        <view class="profile-name-row">
          <text class="profile-name">{{ displayName }}</text>
          <text class="profile-badge">{{ teamBadgeLabel }}</text>
        </view>
        <text class="profile-handle">{{ displayHandle }}</text>
        <view class="profile-actions-row">
          <text class="profile-edit-chip" @tap.stop="handleEditProfile">{{ currentUser ? "编辑资料" : "去登录" }}</text>
          <text v-if="currentUser" class="profile-edit-chip profile-logout-chip" @tap.stop="handleLogout">退出登录</text>
        </view>
        <text class="profile-team-line">当前球队 · {{ currentTeam?.name || "未加入球队" }}</text>
      </view>
      <text class="profile-chevron">›</text>
    </view>

    <scroll-view class="team-switch-scroll" scroll-x>
      <view class="team-switch-row">
        <view
          v-for="team in teamProfiles"
          :key="team.id"
          :class="['team-chip', currentTeam?.id === team.id ? 'team-chip-active' : '', isSwitchingTeam ? 'team-chip-pending' : '']"
          @tap.stop="handleSwitchTeam(team.id)"
        >
          <text class="team-chip-name">{{ team.name }}</text>
        </view>
      </view>
    </scroll-view>

    <view v-if="availableIdentities.length" class="identity-section">
      <view class="identity-section-head">
        <text class="identity-section-label">当前身份</text>
        <text class="identity-section-value">
          {{ currentIdentity ? `${currentIdentity.label} · ${currentIdentity.roleLabel}` : "请选择发布身份" }}
        </text>
      </view>
      <scroll-view class="identity-switch-scroll" scroll-x>
        <view class="identity-switch-row">
          <view
            v-for="identity in availableIdentities"
            :key="identity.id"
            :class="['identity-chip', currentIdentity?.id === identity.id ? 'identity-chip-active' : '']"
            @tap.stop="handleSwitchIdentity(identity.id)"
          >
            <text class="identity-chip-role">{{ identity.roleLabel }}</text>
            <text class="identity-chip-name">{{ identity.label }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="profile-stats-row">
      <view class="profile-stat-item">
        <view class="profile-stat-icon">赛</view>
        <view class="profile-stat-copy">
          <text class="profile-stat-label">今年活动</text>
          <text class="profile-stat-value">{{ overviewDigest.activityCount }}<text class="profile-stat-unit"> 次</text></text>
        </view>
      </view>
      <view class="profile-stat-item">
        <view class="profile-stat-icon profile-stat-icon-blue">队</view>
        <view class="profile-stat-copy">
          <text class="profile-stat-label">加入球队</text>
          <text class="profile-stat-value">{{ overviewDigest.teamCount }}<text class="profile-stat-unit"> 支</text></text>
        </view>
      </view>
      <view class="profile-stat-item">
        <view class="profile-stat-icon profile-stat-icon-orange">时</view>
        <view class="profile-stat-copy">
          <text class="profile-stat-label">今年时长</text>
          <text class="profile-stat-value">{{ overviewDigest.totalHoursLabel }}</text>
        </view>
      </view>
      <view class="profile-stat-item">
        <view class="profile-stat-icon profile-stat-icon-green">天</view>
        <view class="profile-stat-copy">
          <text class="profile-stat-label">加入当前球队</text>
          <text class="profile-stat-value">{{ currentTeamJoinedDaysLabel }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.profile-shell {
  margin-top: 0;
  padding: 28rpx 26rpx 22rpx;
  border-radius: 34rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24rpx 52rpx rgba(17, 17, 17, 0.08);
  border: 2rpx solid rgba(255, 255, 255, 0.6);
}

.profile-main-row {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.profile-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 116rpx;
  height: 116rpx;
  border-radius: 999rpx;
  background: #1b1c19;
  color: #c8ff00;
  font-size: 42rpx;
  font-weight: 900;
  overflow: hidden;
  flex-shrink: 0;
  border: 4rpx solid #edff6a;
  box-shadow: 0 14rpx 26rpx rgba(177, 205, 0, 0.25);
}

.profile-avatar-image {
  width: 100%;
  height: 100%;
}

.profile-copy {
  min-width: 0;
  flex: 1;
}

.profile-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.profile-name {
  font-size: 40rpx;
  color: #10110f;
  font-weight: 900;
}

.profile-badge {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #5d81ff 0%, #4771f3 100%);
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 900;
}

.profile-handle,
.profile-team-line {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6c7168;
}

.profile-actions-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 10rpx;
}

.profile-edit-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 42rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #4f544c;
  font-size: 22rpx;
  font-weight: 800;
}

.profile-logout-chip {
  background: #fff0f1;
  color: #d14c63;
}

.profile-chevron {
  margin-left: 8rpx;
  color: #8f9488;
  font-size: 40rpx;
  line-height: 1;
}

.team-switch-scroll {
  margin-top: 18rpx;
}

.team-switch-row {
  display: inline-flex;
  gap: 12rpx;
}

.team-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 156rpx;
  height: 70rpx;
  padding: 0 22rpx;
  border-radius: 24rpx;
  background: rgba(239, 241, 234, 0.92);
}

.team-chip-pending {
  pointer-events: none;
}

.team-chip-active {
  background: #d8ff1d;
  box-shadow: 0 10rpx 20rpx rgba(169, 206, 0, 0.24);
}

.team-chip-name {
  display: block;
  font-size: 28rpx;
  color: #171814;
  font-weight: 900;
}

.identity-section {
  margin-top: 18rpx;
  padding: 18rpx;
  border-radius: 28rpx;
  background: rgba(247, 248, 244, 0.92);
}

.identity-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.identity-section-label,
.identity-section-value {
  font-weight: 900;
}

.identity-section-label {
  flex: 0 0 auto;
  font-size: 24rpx;
  color: #4f544c;
}

.identity-section-value {
  min-width: 0;
  flex: 1;
  color: #171814;
  font-size: 24rpx;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.identity-switch-scroll {
  margin-top: 14rpx;
}

.identity-switch-row {
  display: inline-flex;
  gap: 12rpx;
}

.identity-chip {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  max-width: 420rpx;
  height: 64rpx;
  padding: 0 18rpx;
  border-radius: 22rpx;
  background: #ffffff;
  border: 2rpx solid rgba(20, 21, 18, 0.08);
  box-sizing: border-box;
}

.identity-chip-active {
  background: #111310;
  border-color: #111310;
  box-shadow: 0 12rpx 24rpx rgba(17, 19, 16, 0.16);
}

.identity-chip-role,
.identity-chip-name {
  display: block;
  font-weight: 900;
}

.identity-chip-role {
  flex: 0 0 auto;
  padding: 6rpx 10rpx;
  border-radius: 999rpx;
  background: #e8f4c4;
  color: #526a00;
  font-size: 20rpx;
}

.identity-chip-active .identity-chip-role {
  background: #c8ff00;
  color: #111310;
}

.identity-chip-name {
  min-width: 0;
  color: #171814;
  font-size: 24rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.identity-chip-active .identity-chip-name {
  color: #ffffff;
}

.profile-stats-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx 12rpx;
  margin-top: 22rpx;
  padding-top: 18rpx;
  border-top: 2rpx solid rgba(20, 21, 18, 0.06);
}

.profile-stat-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}

.profile-stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52rpx;
  height: 52rpx;
  border-radius: 18rpx;
  background: rgba(200, 255, 0, 0.2);
  color: #4d6500;
  font-size: 24rpx;
  font-weight: 900;
  flex-shrink: 0;
}

.profile-stat-icon-blue {
  background: rgba(81, 129, 255, 0.14);
  color: #4f74ec;
}

.profile-stat-icon-orange {
  background: rgba(255, 176, 48, 0.16);
  color: #d27e00;
}

.profile-stat-icon-green {
  background: rgba(21, 128, 61, 0.12);
  color: #15803d;
}

.profile-stat-copy {
  min-width: 0;
  flex: 1;
}

.profile-stat-label {
  display: block;
  font-size: 20rpx;
  color: #7a7f76;
  font-weight: 700;
}

.profile-stat-value {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #161713;
  font-weight: 900;
}

.profile-stat-unit {
  font-size: 20rpx;
}
</style>
