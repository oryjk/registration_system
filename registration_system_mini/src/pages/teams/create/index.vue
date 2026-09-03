<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import AppTabHeader from "@/components/AppTabHeader.vue";
import NeoConfirmDialog from "@/components/neo/NeoConfirmDialog.vue";
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
  <view class="team-create-page" :style="pageStyle">
    <AppTabHeader title="创建球队" showBack />

    <view class="team-create-content">
      <view class="team-create-hero">
        <view class="team-create-hero__copy">
          <text class="team-create-title">创建一支新球队</text>
          <text class="team-create-copy">创建后你自动成为队长，可以邀请队员、约队和报名比赛；一个人可以创建多支球队。</text>
        </view>
        <view class="team-create-hero__mark">
          <text>队</text>
        </view>
      </view>

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
    <NeoConfirmDialog
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
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.team-create-content {
  width: 100%;
  max-width: 900rpx;
  margin: 0 auto;
  box-sizing: border-box;
}

.team-create-hero {
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

.team-create-hero__copy {
  flex: 1;
  min-width: 0;
}

.team-create-title {
  display: block;
  color: var(--neo-color-text-inverse);
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1.18;
}

.team-create-copy {
  display: block;
  margin-top: 12rpx;
  color: rgba(255, 255, 255, 0.72);
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.55;
}

.team-create-hero__mark {
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

.team-create-alt {
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

.team-create-alt--pressed {
  transform: translate(var(--neo-motion-press-offset), var(--neo-motion-press-offset));
  box-shadow: none;
}

.team-create-alt__label {
  color: var(--neo-color-text-muted);
  font-size: 26rpx;
  font-weight: 800;
}

.team-create-alt__arrow {
  color: var(--neo-color-text);
  font-size: 26rpx;
  font-weight: 900;
}

@media (max-width: 560rpx) {
  .team-create-hero__mark {
    width: 88rpx;
    height: 88rpx;
    font-size: 34rpx;
  }
}
</style>
