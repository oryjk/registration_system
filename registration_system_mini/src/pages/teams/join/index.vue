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
  <view class="team-join-page" :style="pageStyle">
    <AppTabHeader title="加入球队" showBack />

    <view class="team-join-content">
      <view class="team-join-hero">
        <view class="team-join-hero__copy">
          <text class="team-join-title">加入一支球队</text>
          <text class="team-join-copy">搜索球队名称并申请加入；已经在球队中的队员也可以加入其他球队。</text>
        </view>
        <view class="team-join-hero__mark">
          <text>加</text>
        </view>
      </view>

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
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.team-join-content {
  width: 100%;
  max-width: 900rpx;
  margin: 0 auto;
  box-sizing: border-box;
}

.team-join-hero {
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

.team-join-hero__copy {
  flex: 1;
  min-width: 0;
}

.team-join-title {
  display: block;
  color: var(--neo-color-hero-fg);
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1.18;
}

.team-join-copy {
  display: block;
  margin-top: 12rpx;
  color: rgba(255, 255, 255, 0.72);
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.55;
}

.team-join-hero__mark {
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

.team-join-alt {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  margin-top: 26rpx;
  padding: 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
}

.team-join-alt--pressed {
  transform: translate(var(--neo-motion-press-offset), var(--neo-motion-press-offset));
  box-shadow: none;
}

.team-join-alt__label {
  color: var(--neo-color-text-muted);
  font-size: 26rpx;
  font-weight: 800;
}

.team-join-alt__arrow {
  color: var(--neo-color-text);
  font-size: 26rpx;
  font-weight: 900;
}

@media (max-width: 560rpx) {
  .team-join-hero__mark {
    width: 88rpx;
    height: 88rpx;
    font-size: 34rpx;
  }
}
</style>
