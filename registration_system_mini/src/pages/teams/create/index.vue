<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import AppTabHeader from "@/components/AppTabHeader.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import TeamCreatePanel from "../components/TeamCreatePanel.vue";
import { useTeamCreatePage } from "./useTeamCreatePage";

const { themePageStyle } = useAccentTheme();

const {
  pageStyle,
  createForm,
  createTeamReviewMode,
  reviewTeamNameOptions,
  canCreate,
  submitting,
  logoLocalPath,
  handlePickLogo,
  handleRemoveLogo,
  onboardingShareVisible,
  handleOnboardingShareConfirmed,
  handleOnboardingShareDeclined,
  handleCreateTeam,
  goJoinTeam,
} = useTeamCreatePage();
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope team-create-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader title="创建球队" showBack />

    <view class="team-create-content">
      <text class="team-page-note">创建后你将成为队长，可邀请队友加入。</text>

      <TeamCreatePanel
        :form="createForm"
        :logo-local-path="logoLocalPath"
        :review-mode="createTeamReviewMode"
        :review-team-name-options="reviewTeamNameOptions"
        :can-create="canCreate"
        :submitting="submitting"
        @pick-logo="handlePickLogo"
        @remove-logo="handleRemoveLogo"
        @submit="handleCreateTeam"
      />

      <view class="team-create-alt" hover-class="team-create-alt--pressed" @tap="goJoinTeam">
        <text class="team-create-alt__label">已有心仪的球队？去搜索加入</text>
        <text class="team-create-alt__arrow">→</text>
      </view>
    </view>

    <!-- 新手引导创建成功后的分享提示（自绘弹窗，无 showModal 按钮文案 4 字限制） -->
    <ConfirmDialog
      :visible="onboardingShareVisible"
      title="球队创建成功！"
      message="把球队分享给队员，邀请他们加入吧。"
      primary-text="去邀请队员"
      secondary-text="稍后"
      @primary="handleOnboardingShareConfirmed"
      @secondary="handleOnboardingShareDeclined"
      @close="handleOnboardingShareDeclined"
    />
  </view>
</template>

<style scoped>
.team-create-page {
  min-height: 100vh;
  padding: 0 28rpx 112rpx;
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.team-create-content {
  width: 100%;
  max-width: 900rpx;
  margin: 0 auto;
  box-sizing: border-box;
}

.team-create-alt {
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

.team-create-alt--pressed {
  transform: scale(0.98);
  box-shadow: none;
}

.team-create-alt__label {
  color: var(--ui-color-text-muted);
  font-size: 26rpx;
  font-weight: 500;
}

.team-create-alt__arrow {
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 600;
}


.team-page-note { display: block; margin: 4rpx 4rpx 20rpx; color: var(--ui-color-text-muted); font-size: 24rpx; line-height: 1.5; }
</style>
