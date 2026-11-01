<script setup lang="ts">
import { watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { useOnboardingIllustrations } from "@/composables/useOnboardingIllustrations";
import { useAccentTheme } from "@/stores/theme";
import AppTabHeader from "@/components/AppTabHeader.vue";
import ProfileCompletionDialog from "@/components/ProfileCompletionDialog.vue";
import TeamJoinedNextSteps from "../onboarding/TeamJoinedNextSteps.vue";
import TeamJoinPanel from "../components/TeamJoinPanel.vue";
// #ifdef MP-WEIXIN
import AppPageIntro from "@/components/ui/AppPageIntro.vue";
import { HOME_VISUAL_ASSETS } from "@/config/homeVisualAssets";
// #endif
import { useTeamJoinPage } from "./useTeamJoinPage";

const { themePageStyle } = useAccentTheme();

const {
  joinedTeam,
  goJoinedTeam,
  goFindMatches,
  pageStyle,
  searching,
  hasSearched,
  searchKeyword,
  searchResults,
  selectedTeam,
  selectedTeamIsMember,
  joinedTeamIds,
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

const { illustrations, illustrationRevision, refreshIllustrations } = useOnboardingIllustrations();
watch(() => joinedTeam.value, (ready) => { if (ready) void refreshIllustrations(); });
onShow(() => { if (joinedTeam.value) void refreshIllustrations(); });
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope team-join-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader title="加入球队" showBack />

    <view class="team-join-content">
      <TeamJoinedNextSteps :image-revision="illustrationRevision" :image-url="illustrations.team" v-if="joinedTeam" @team="goJoinedTeam" @matches="goFindMatches" />
      <template v-else>
      <!-- #ifdef MP-WEIXIN -->
      <view class="team-join-intro"><AppPageIntro title="找到你的球队" description="找到一起踢球的伙伴，搜索名称即可加入。" :image-url="HOME_VISUAL_ASSETS.joinTeam" /></view>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <text class="team-page-note">找到一起踢球的伙伴，搜索名称即可加入。</text>
      <!-- #endif -->

      <TeamJoinPanel
        v-model:search-keyword="searchKeyword"
        v-model:join-password="joinPassword"
        :searching="searching"
        :has-searched="hasSearched"
        :search-results="searchResults"
        :selected-team="selectedTeam"
        :selected-team-is-member="selectedTeamIsMember"
        :joined-team-ids="joinedTeamIds"
        :selected-team-requires-password="selectedTeamRequiresPassword"
        :can-join="canJoin"
        :submitting="submitting"
        @search="handleSearchTeams"
        @select-team="handleSelectTeam"
        @join="handleJoinTeam"
      />

      <view
        v-if="canShowCreateEntry"
        class="team-join-alt ui-subtle-control"
        hover-class="team-join-alt--pressed"
        @tap="goCreateTeam"
      >
        <text class="team-join-alt__label">没有找到？创建自己的球队</text>
        <text class="ui-arrow-text team-join-alt__arrow">→</text>
      </view>
      </template>
    </view>

    <ProfileCompletionDialog
      :visible="profileGateVisible"
      @completed="handleProfileGateCompleted"
      @cancel="handleProfileGateCancel"
    />
  </view>
</template>

<style scoped>
@import "@/styles/list-surfaces.css";
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

/* #ifdef MP-WEIXIN */
/* 微信端复用统一排版尺度；H5 保留原有样式。 */
.team-join-page { padding: 0 var(--ui-page-padding-inline) var(--ui-page-padding-bottom); }
.team-join-alt { gap: var(--ui-space-2); margin-top: var(--ui-section-gap); padding: var(--ui-space-4) var(--ui-space-5); border: var(--ui-control-border); border-radius: var(--ui-control-radius); background: var(--ui-control-subtle-bg); }
.team-join-alt__label { font-size: var(--ui-text-label); font-weight: var(--ui-font-weight-medium); }
.team-join-alt__arrow { font-size: var(--ui-text-label); font-weight: var(--ui-font-weight-heading); }
.team-page-note { margin: var(--ui-space-1) var(--ui-space-1) var(--ui-space-5); font-size: var(--ui-text-body); line-height: var(--ui-line-height-body); }
.team-join-intro { margin-bottom: var(--ui-section-gap); }
/* #endif */
</style>
