<script setup lang="ts">
import { watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import OnboardingIllustration from "@/components/OnboardingIllustration.vue";
import { useOnboardingIllustrations } from "@/composables/useOnboardingIllustrations";
import { useAccentTheme } from "@/stores/theme";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
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
  createdTeamId,
  nextStepBusy,
  canArrangeMatch,
  goInviteTeam,
  goArrangeMatch,
  handleCreateTeam,
  goJoinTeam,
} = useTeamCreatePage();

const { illustrations, illustrationRevision, refreshIllustrations } = useOnboardingIllustrations();
watch(createdTeamId, (id) => { if (id) void refreshIllustrations(); });
onShow(() => { if (createdTeamId.value) void refreshIllustrations(); });
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope team-create-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader title="创建球队" showBack />

    <view class="team-create-content">
      <AppSurface v-if="createdTeamId" flush>
        <view class="created-next">
          <OnboardingIllustration :revision="illustrationRevision" :src="illustrations.team" />
          <text class="created-next__status">球队创建成功</text>
          <text class="created-next__title">邀请队友，准备第一场比赛</text>
          <text class="team-page-note">进入球队主页，点击「分享邀请，拉球友入队」，把邀请卡片发给队友。</text>
          <AppButton block @click="goInviteTeam">邀请队友</AppButton>
          <AppButton v-if="canArrangeMatch" block variant="outline" :loading="nextStepBusy" @click="goArrangeMatch">先安排比赛</AppButton>
        </view>
      </AppSurface>
      <template v-else>
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
      </template>
    </view>

  </view>
</template>

<style scoped>
.created-next { display: flex; flex-direction: column; gap: 20rpx; padding: 28rpx; }
.created-next__status { color: var(--ui-color-success-fg); font-size: 24rpx; font-weight: 600; }
.created-next__title { color: var(--ui-color-text); font-size: 32rpx; font-weight: 600; }
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
