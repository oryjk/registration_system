<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import AppTabHeader from "@/components/AppTabHeader.vue";
import ProfileCompletionDialog from "@/components/ProfileCompletionDialog.vue";
import TeamJoinPanel from "../components/TeamJoinPanel.vue";
import { useTeamJoinPage } from "./useTeamJoinPage";

const { themePageStyle } = useAccentTheme();

const {
  pageStyle,
  searching,
  searchKeyword,
  searchResults,
  selectedTeam,
  selectedTeamRequiresPassword,
  joinPassword,
  canJoin,
  submitting,
  canShowCreateEntry,
  profileGateVisible,
  handleProfileGateCompleted,
  handleProfileGateCancel,
  handleSearchTeams,
  handleSelectTeam,
  handleJoinTeam,
  goCreateTeam,
} = useTeamJoinPage();
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope team-join-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader title="加入球队" showBack />

    <view class="team-join-content">
      <text class="team-page-note">搜索球队名称，选择后申请加入。</text>

      <TeamJoinPanel
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

      <view
        v-if="canShowCreateEntry"
        class="team-join-alt"
        hover-class="team-join-alt--pressed"
        @tap="goCreateTeam"
      >
        <text class="team-join-alt__label">没找到想要的球队？创建一支</text>
        <text class="team-join-alt__arrow">→</text>
      </view>
    </view>

    <ProfileCompletionDialog
      :visible="profileGateVisible"
      @completed="handleProfileGateCompleted"
      @cancel="handleProfileGateCancel"
    />
  </view>
</template>

<style scoped>
.team-join-page {
  min-height: 100vh;
  padding: 0 28rpx 112rpx;
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.team-join-content {
  width: 100%;
  max-width: 900rpx;
  margin: 0 auto;
  box-sizing: border-box;
}

.team-join-alt {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  margin-top: 26rpx;
  padding: 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
}

.team-join-alt--pressed {
  transform: scale(0.98);
  box-shadow: none;
}

.team-join-alt__label {
  color: var(--ui-color-text-muted);
  font-size: 26rpx;
  font-weight: 500;
}

.team-join-alt__arrow {
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 600;
}


.team-page-note { display: block; margin: 4rpx 4rpx 20rpx; color: var(--ui-color-text-muted); font-size: 24rpx; line-height: 1.5; }
</style>
