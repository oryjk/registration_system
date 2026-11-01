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
// #ifdef MP-WEIXIN
import { computed, ref } from "vue";
import TeamCreateIntro from "./TeamCreateIntro.vue";
import { useMinioImages } from "@/composables/useMinioImages";
import { HOME_VISUAL_ASSETS } from "@/config/homeVisualAssets";
const { minioImageSrc } = useMinioImages();
const joinIllustrationFailed = ref(false);
const joinIllustrationSrc = computed(() => joinIllustrationFailed.value ? "" : minioImageSrc(HOME_VISUAL_ASSETS.joinTeam));
// #endif

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
  <view class="app-theme-scope ui-card-page team-create-page" :style="[themePageStyle, pageStyle]">
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
        <!-- #ifdef MP-WEIXIN -->
        <TeamCreateIntro />
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <text class="team-page-note">创建后你将成为队长，可邀请队友加入。</text>
        <!-- #endif -->

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

        <view class="team-create-alt ui-subtle-control" hover-class="team-create-alt--pressed" @tap="goJoinTeam">
          <!-- #ifdef MP-WEIXIN -->
          <image v-if="joinIllustrationSrc" class="team-create-alt__illustration" :src="joinIllustrationSrc" mode="aspectFit" aria-hidden="true" @error="joinIllustrationSrc && (joinIllustrationFailed = true)" />
          <!-- #endif -->
          <text class="team-create-alt__label">已有心仪的球队？去搜索加入</text>
          <text class="ui-arrow-text team-create-alt__arrow">→</text>
        </view>
      </template>
    </view>

  </view>
</template>

<style scoped>
@import "@/styles/page-surfaces.css";
@import "@/styles/list-surfaces.css";
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
/* #ifdef MP-WEIXIN */
.team-create-alt { justify-content: flex-start; gap: 16rpx; padding: 20rpx 24rpx; }
.team-create-alt__illustration { flex-shrink: 0; width: 60rpx; height: 60rpx; }
.team-create-alt__label { flex: 1; min-width: 0; font-size: 24rpx; line-height: 1.5; }
.team-create-alt__arrow { flex-shrink: 0; }
/* #endif */

/* #ifdef MP-WEIXIN */
/* 微信端复用统一排版尺度；H5 保留原有样式。 */
.created-next { gap: var(--ui-list-gap); padding: var(--ui-card-padding); }
.created-next__status { font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-heading); }
.created-next__title { font-size: var(--ui-text-title); font-weight: var(--ui-font-weight-heading); }
.team-create-page { padding: 0 var(--ui-page-padding-inline) var(--ui-page-padding-bottom); }
.team-create-alt { gap: var(--ui-space-4); margin-top: var(--ui-section-gap); padding: var(--ui-space-4) var(--ui-space-5); border: var(--ui-control-border); border-radius: var(--ui-control-radius); background: var(--ui-control-subtle-bg); }
.team-create-alt__label { font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-medium); line-height: var(--ui-line-height-body); }
.team-create-alt__arrow { font-size: var(--ui-text-label); font-weight: var(--ui-font-weight-heading); }
.team-page-note { margin: var(--ui-space-1) var(--ui-space-1) var(--ui-space-5); font-size: var(--ui-text-body); line-height: var(--ui-line-height-body); }
.team-create-alt__illustration { width: var(--ui-avatar-size-lg); height: var(--ui-avatar-size-lg); }
/* #endif */
</style>
