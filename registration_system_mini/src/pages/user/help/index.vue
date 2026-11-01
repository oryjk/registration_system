<script setup lang="ts">
// #ifdef MP-WEIXIN
import AppPageIntro from "@/components/ui/AppPageIntro.vue";
import { HOME_VISUAL_ASSETS } from "@/config/homeVisualAssets";
// #endif
import OnboardingIllustration from "@/components/OnboardingIllustration.vue";
import { useOnboardingIllustrations } from "@/composables/useOnboardingIllustrations";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import { useOnboardingNavigation } from "@/composables/useOnboardingNavigation";
import { useAccentTheme } from "@/stores/theme";
import { useMiniReviewStatus } from "@/stores/miniReview";
import { getCustomNavMetrics } from "@/utils/customNav";
import { consumeHomeOnboardingTourRequest, requestHomeOnboardingTour } from "@/utils/onboardingTourStorage";

const { illustrations, illustrationRevision, refreshIllustrations } = useOnboardingIllustrations();
const { themePageStyle } = useAccentTheme();
const { shouldHideCreationEntrances, preloadMiniReviewStatus } = useMiniReviewStatus();
const { busy, navigateTo } = useOnboardingNavigation();
const pageStyle = { paddingTop: `${getCustomNavMetrics().pageTopPadding + 8}px` };

function createTeam() {
  if (shouldHideCreationEntrances.value) return;
  void navigateTo("/pages/teams/create/index?from=onboarding");
}
function joinTeam() {
  void navigateTo("/pages/teams/join/index");
}
function findMatch() {
  uni.switchTab({ url: "/pages/activities/index" });
}
function replayOnboarding() {
  requestHomeOnboardingTour();
  uni.switchTab({
    url: "/pages/home/index",
    fail: () => {
      consumeHomeOnboardingTourRequest();
      uni.showToast({ title: "首页暂时无法打开，请重试", icon: "none" });
    },
  });
}
onShow(() => { void preloadMiniReviewStatus(); void refreshIllustrations(); });
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope ui-card-page help-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader title="使用帮助" showBack />
    <view class="help-content">
      <!-- #ifdef MP-WEIXIN -->
      <view class="help-intro-panel"><AppPageIntro title="一起踢球，只差几步" description="选一件现在想做的事，随时可以换一种方式参与。" :image-url="HOME_VISUAL_ASSETS.findGame" /></view>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <view class="help-intro">
        <OnboardingIllustration :revision="illustrationRevision" :src="illustrations.welcome" />
        <text class="help-eyebrow">第一次来，从这里开始</text>
        <text class="help-title">一起踢球，只差几步</text>
        <text class="help-description">选一件现在想做的事，随时可以换一种方式参与。</text>
      </view>
      <!-- #endif -->
      <view class="help-replay">
        <AppButton block variant="outline" @click="replayOnboarding">重新查看新手引导</AppButton>
      </view>
      <view class="help-actions">
        <view v-if="!shouldHideCreationEntrances" class="help-action"><AppButton block :disabled="busy" @click="createTeam">创建球队</AppButton></view>
        <view class="help-action"><AppButton block variant="outline" :disabled="busy" @click="joinTeam">加入球队</AppButton></view>
        <view class="help-action"><AppButton block variant="outline" @click="findMatch">找比赛</AppButton></view>
      </view>
      <text class="help-login-note">需要登录时，页面会提示你继续操作。</text>

      <view v-if="!shouldHideCreationEntrances" class="help-route ui-card-panel">
        <text class="help-route-title">我想组织一支球队</text>
        <text class="ui-arrow-text help-route-summary">创建球队 → 邀请队友 → 发起比赛 → 分享报名</text>
        <view class="help-step"><text class="help-step-number">1</text><text>点击「创建球队」，填写球队资料，创建后你就是队长。</text></view>
        <view class="help-step"><text class="help-step-number">2</text><text>创建成功后选择「邀请队友」，把球队邀请分享给队友，让他们加入。</text></view>
        <view class="help-step"><text class="help-step-number">3</text><text>回到首页，点击底部「＋」中的「创建比赛」，确认时间、地点和费用后发布。</text></view>
        <view class="help-step"><text class="help-step-number">4</text><text>打开比赛详情并分享给队友，队友打开后即可按页面提示报名。</text></view>
      </view>

      <view class="help-route ui-card-panel">
        <text class="help-route-title">我已经有一起踢球的队友</text>
        <text class="ui-arrow-text help-route-summary">找到球队 → 加入球队 → 报名比赛</text>
        <view class="help-step"><text class="help-step-number">1</text><text>点击「加入球队」搜索球队名称，或直接打开队友发来的球队邀请。</text></view>
        <view class="help-step"><text class="help-step-number">2</text><text>确认球队后加入；如需入队密码，向队长或队友索取。按提示完善个人资料。</text></view>
        <view class="help-step"><text class="help-step-number">3</text><text>回到首页查看球队比赛，或打开队友分享的比赛，进入详情确认信息后报名。</text></view>
      </view>

      <view class="help-route ui-card-panel">
        <text class="help-route-title">我想先找一场球踢</text>
        <text class="ui-arrow-text help-route-summary">找比赛 → 确认时间、地点、费用 → 报名</text>
        <view class="help-step"><text class="help-step-number">1</text><text>点击「找比赛」进入约队大厅，浏览适合个人参加的散人约球。</text></view>
        <view class="help-step"><text class="help-step-number">2</text><text>打开比赛详情，查看时间、球场位置、费用与支付方式，并确认还有报名名额。</text></view>
        <view class="help-step"><text class="help-step-number">3</text><text>按页面提示登录、完善资料并报名；若要求赛前支付，完成支付后再确认自己的报名状态。</text></view>
      </view>
      <text class="help-footer">这里的入口只帮你开始操作，不会固定你的身份。之后仍可加入球队或参加其他比赛。</text>
    </view>
  </view>
</template>

<style scoped>
@import "@/styles/page-surfaces.css";
@import "@/styles/list-surfaces.css";

.help-page { min-height:100vh; padding:0 28rpx calc(env(safe-area-inset-bottom) + 48rpx); box-sizing:border-box; background:var(--ui-color-page); }
.help-content { max-width:750rpx; margin:0 auto; }
.help-replay { margin: 0 0 24rpx; }
.help-intro { padding:24rpx 0; }
.help-eyebrow { display:block; color:var(--ui-color-text-muted); font-size:24rpx; }
.help-title { display:block; margin-top:12rpx; color:var(--ui-color-text); font-size:40rpx; font-weight:var(--ui-font-weight-heading); }
.help-description,.help-login-note,.help-footer { display:block; color:var(--ui-color-text-muted); font-size:24rpx; line-height:1.65; }
.help-description { margin-top:14rpx; }
.help-actions { display:flex; flex-wrap:wrap; gap:16rpx; }
.help-action { flex:1; min-width:180rpx; }
.help-login-note { margin:16rpx 0 28rpx; font-size:22rpx; }
.help-route { margin-top:24rpx; padding:28rpx; border:var(--ui-border-default); border-radius:var(--ui-radius-card); background:var(--ui-color-surface); }
.help-route-title { display:block; color:var(--ui-color-text); font-size:32rpx; font-weight:var(--ui-font-weight-heading); }
.help-route-summary { display:block; margin-top:12rpx; color:var(--ui-color-text-muted); font-size:24rpx; line-height:1.6; }
.help-step { display:flex; align-items:flex-start; gap:16rpx; margin-top:24rpx; color:var(--ui-color-text-muted); font-size:26rpx; line-height:1.65; }
.help-step-number { flex-shrink:0; display:flex; align-items:center; justify-content:center; width:40rpx; height:40rpx; border-radius:var(--ui-radius-round); background:var(--ui-color-neutral-bg); color:var(--ui-color-neutral-fg); font-size:24rpx; font-variant-numeric:tabular-nums; }
.help-footer { margin:28rpx 0 0; }

/* #ifdef MP-WEIXIN */
.help-page { padding-right: var(--ui-page-padding-inline); padding-left: var(--ui-page-padding-inline); padding-bottom: calc(env(safe-area-inset-bottom) + var(--ui-page-padding-bottom)); }
.help-intro-panel { margin-bottom: var(--ui-space-6); }
.help-replay { margin-bottom: var(--ui-space-6); }
.help-actions { gap: var(--ui-space-4); }
.help-route { margin-top: var(--ui-card-gap); padding: var(--ui-card-padding); border: var(--ui-panel-border); border-radius: var(--ui-card-radius); background: var(--ui-card-bg); }
.help-route-title { font-size: var(--ui-text-title); }
.help-route-summary { margin-top: var(--ui-space-3); font-size: var(--ui-text-body); line-height: var(--ui-line-height-body); }
.help-step { gap: var(--ui-space-4); margin-top: var(--ui-space-6); font-size: var(--ui-text-label); line-height: var(--ui-line-height-body); }
.help-step-number { width: var(--ui-icon-lg); height: var(--ui-icon-lg); background: var(--ui-control-subtle-bg); color: var(--ui-color-text); font-size: var(--ui-text-body); }
.help-login-note { margin: var(--ui-space-4) 0 var(--ui-space-7); font-size: var(--ui-text-sm); line-height: var(--ui-line-height-body); }
.help-footer { margin-top: var(--ui-section-gap); font-size: var(--ui-text-body); line-height: var(--ui-line-height-body); }
/* #endif */
</style>
