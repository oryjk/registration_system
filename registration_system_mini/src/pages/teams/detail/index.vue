<script setup lang="ts">
import { useMinioImages } from "@/composables/useMinioImages";
import { onShareAppMessage, onShareTimeline } from "@dcloudio/uni-app";
import { useAccentTheme } from "@/stores/theme";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import AppTag from "@/components/ui/AppTag.vue";
import { useTeamDetailPage } from "./useTeamDetailPage";

const { minioImageSrc } = useMinioImages();

const { themePageStyle } = useAccentTheme();

const {
  pageStyle,
  team,
  isLoading,
  errorMessage,
  balanceLabel,
  roleLabel,
  canManage,
  canLeaveTeam,
  logoUrl,
  description,
  createdLabel,
  inviteCode,
  shareImagePath,
  shareImageUrl,
  leaveDialogVisible,
  handleLeaveTeamClick,
  handleLeaveTeamConfirm,
  membershipLabel,
  loadTeam,
  openTeamManage,
  openTeamFund,
} = useTeamDetailPage();

// 分享邀请：落地到独立邀请页（带邀请码），非成员凭码查看球队并申请加入。
// 缩略图用拉新专用封面（有队徽时为预合成图）：默认截图会带上分享人的队内余额，属敏感信息。
onShareAppMessage(() => ({
  title: team.value ? `邀请你加入球队「${team.value.name}」` : "邀请你加入球队",
  path: `/pages/teams/invite/index?code=${encodeURIComponent(inviteCode.value)}`,
  imageUrl: shareImagePath.value || shareImageUrl.value,
}));

onShareTimeline(() => ({
  title: team.value ? `邀请你加入球队「${team.value.name}」` : "邀请你加入球队",
  query: `code=${encodeURIComponent(inviteCode.value)}`,
  imageUrl: shareImagePath.value || shareImageUrl.value,
}));
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope team-detail-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader :title="team?.name || '球队'" showBack />

    <view class="team-detail-content">
      <view v-if="errorMessage" class="state-card" @tap="loadTeam">
        <text class="state-text">{{ errorMessage }}，点击重试</text>
      </view>
      <view v-else-if="isLoading && !team" class="state-card">
        <text class="state-text">正在加载球队信息...</text>
      </view>

      <template v-else-if="team">
        <view class="page-hero ui-plain-panel">
          <view class="hero-row">
            <view class="hero-badge">
              <image v-if="logoUrl" class="hero-badge__logo" :src="minioImageSrc(logoUrl)" mode="aspectFill" />
              <text v-else>{{ team.name.slice(0, 1) || "队" }}</text>
            </view>
            <view class="hero-copy">
              <text class="hero-title">{{ team.name }}</text>
              <text class="hero-meta">{{ roleLabel }} · 信用分 {{ team.credit_score }}</text>
              <text v-if="createdLabel" class="hero-meta">创建于 {{ createdLabel }}</text>
            </view>
            <AppTag :tone="team.is_vip ? 'lime' : 'amber'" size="lg">{{ membershipLabel }}</AppTag>
          </view>
          <text v-if="description" class="hero-description">{{ description }}</text>
        </view>

        <!-- 队费下放子页后的轻量入口：展示余额，点击进入队费缴纳页。 -->
        <view class="fund-entry ui-soft-panel" hover-class="fund-entry--pressed" @tap="openTeamFund">
          <view class="fund-entry__main">
            <text class="fund-entry__label">队费余额</text>
            <view class="fund-entry__amount">
              <text class="fund-entry__symbol">¥</text>
              <text class="fund-entry__value">{{ balanceLabel }}</text>
            </view>
          </view>
          <view class="fund-entry__action">
            <text class="fund-entry__action-text">去缴纳</text>
            <text class="ui-arrow-text fund-entry__action-arrow">→</text>
          </view>
        </view>

        <!-- 球队管理入口仅对队长/领队有意义，普通队员不展示。 -->
        <AppSurface v-if="canManage" variant="raised" custom-class="manage-card">
          <view class="manage-head">
            <text class="manage-title">球队管理</text>
            <text class="manage-copy">资料、队员与比赛出勤管理</text>
          </view>
          <AppButton icon="settings" variant="outline" block @click="openTeamManage">
            进入球队管理
          </AppButton>
        </AppSurface>

        <!-- 邀请球友（拉新）：仅队长/领队展示；open-type=share 触发与右上角菜单相同的分享配置。 -->
        <AppSurface v-if="canManage" variant="outlined" custom-class="invite-card">
          <view class="invite-hero">
            <text class="invite-title">邀请球友加入</text>
            <text class="invite-copy">分享邀请卡片给球友，点开即可申请加入{{ team.name }}，7 天内有效。</text>
          </view>
          <button class="invite-share-button" open-type="share" hover-class="invite-share-button--pressed">
            <wd-icon name="share-external" size="34rpx" color="var(--ui-color-accent-fg)" />
            <text class="invite-share-button__text">分享邀请，拉球友入队</text>
          </button>
        </AppSurface>

        <!-- 退出球队：独立卡片，仅非队长的在队成员可见；余额不为零在入口即拦截，后端同样校验。 -->
        <AppSurface v-if="canLeaveTeam" variant="raised" custom-class="leave-card">
          <view class="leave-head">
            <text class="leave-title">退出球队</text>
            <text class="leave-copy">退出后不再参与本球队的比赛与报名；队费余额需为 0 才能退出。</text>
          </view>
          <AppButton icon="poweroff" variant="danger" block @click="handleLeaveTeamClick">
            退出球队
          </AppButton>
        </AppSurface>
      </template>
    </view>

    <!-- 分享封面合成画布：移出屏幕外（canvas 2d 节点不能 display:none，否则无法绘制）。 -->
    <!-- #ifdef MP-WEIXIN -->
    <canvas id="team-share-canvas" type="2d" class="team-share-canvas" />
    <!-- #endif -->

    <!-- 退出球队：二次确认；余额不为零在入口即拦截，后端同样校验。 -->
    <ConfirmDialog
      :visible="leaveDialogVisible"
      title="退出球队"
      message="退出后将不再参与本球队的比赛与报名；队费余额需为 0 才能退出。"
      primary-text="确认退出"
      primary-tone="danger"
      @primary="void handleLeaveTeamConfirm()"
      @secondary="leaveDialogVisible = false"
      @close="leaveDialogVisible = false"
    />
  </view>
</template>

<style scoped>
@import "@/styles/list-surfaces.css";
.team-detail-page {
  min-height: 100vh;
  padding: 0 28rpx 96rpx;
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.team-detail-content {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.state-card,
.page-hero,
.fund-entry {
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-raised);
}

.state-card {
  padding: 40rpx 28rpx;
  text-align: center;
}

.state-text {
  color: var(--ui-color-text-muted);
  font-size: 28rpx;
  font-weight: 500;
}

.page-hero {
  padding: 28rpx;
}

.hero-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.hero-badge {
  position: relative;
  width: 88rpx;
  height: 88rpx;

  border: 0;
  border-radius: var(--ui-radius-button);

  background: var(--ui-color-neutral-bg);

  color: var(--ui-color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: var(--ui-font-weight-heading);
  flex-shrink: 0;
  overflow: hidden;
}

.hero-badge__logo {
  width: 100%;
  height: 100%;
}

.hero-copy {
  min-width: 0;
  flex: 1;
}

.hero-title {
  display: block;
  color: var(--ui-color-text);

  font-size: 32rpx;
  line-height: 1.2;
  font-weight: var(--ui-font-weight-heading);
  overflow: hidden;
  text-overflow: ellipsis;

  white-space: normal;
  overflow-wrap: anywhere;
}

.hero-meta {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 400;
}

.hero-description {
  display: block;
  margin-top: 18rpx;
  color: var(--ui-color-text-muted);
  font-size: 25rpx;
  line-height: 1.55;
  font-weight: 400;
  word-break: break-word;
}

.fund-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 26rpx 28rpx;
}

.fund-entry--pressed {
  transform: translate(2rpx, 2rpx);
  box-shadow: none;
}

.fund-entry__label {
  display: block;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 500;
  letter-spacing: 2rpx;
}

.fund-entry__amount {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
  margin-top: 8rpx;
}

.fund-entry__symbol {
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: 600;
}

.fund-entry__value {
  color: var(--ui-color-text);
  font-size: 46rpx;
  line-height: 1.1;
  font-weight: var(--ui-font-weight-heading);
}

.fund-entry__action {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 20rpx;

  border: 0;
  border-radius: var(--ui-radius-button);

  background: var(--ui-color-accent-soft);
  flex-shrink: 0;
}

.fund-entry__action-text {
  color: var(--ui-color-accent-deep);
  font-size: 24rpx;
  font-weight: 600;
}

.fund-entry__action-arrow {
  color: var(--ui-color-accent-deep);
  font-size: 24rpx;
  font-weight: 600;
}

:deep(.manage-card) {
  padding: 28rpx;
}

.manage-head {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 20rpx;
}

.manage-title {
  color: var(--ui-color-text);
  font-size: 32rpx;
  font-weight: var(--ui-font-weight-heading);
}

.manage-copy {
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 400;
}

/* H5 减少动态效果：邀请分享按钮只保留表面色反馈，无缩放。 */
@media (prefers-reduced-motion: reduce) {
  .invite-share-button {
    transition: none;
  }

  .invite-share-button--pressed {
    transform: none;
    box-shadow: var(--ui-shadow-control-pressed);
  }
}

/* #ifdef H5 */
.team-detail-page {
  width: 100%;
  max-width: 750rpx;
  margin: 0 auto;
}

.team-detail-page :deep(.app-tab-header-shell) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */

/* #ifdef MP-WEIXIN */
.team-share-canvas {
  position: fixed;
  top: -9999px;
  left: -9999px;
  width: 1000px;
  height: 800px;
  pointer-events: none;
}
/* #endif */

.leave-card {
  margin-top: 0;
}

/* 邀请入口与球队资料使用同一轻量表面。 */
:deep(.invite-card) {
  padding: 28rpx;

  background: var(--ui-color-surface);

  box-shadow: none;
}

.invite-hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14rpx;
  margin-bottom: 26rpx;
}

.invite-kicker {
  padding: 6rpx 16rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-accent);
}

.invite-kicker__text {
  color: var(--ui-color-text);
  font-size: 22rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
}

.invite-title {
  color: var(--ui-color-text);

  font-size: 30rpx;
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.2;
}

.invite-copy {
  color: var(--ui-color-text-muted);

  font-size: 23rpx;
  line-height: 1.5;
  font-weight: 400;
}

/* 使用原生分享按钮，图标与比赛详情保持一致。 */
.invite-share-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  width: 100%;
  min-height: 88rpx;
  margin: 0;
  padding: 0 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-accent);
  box-sizing: border-box;
  line-height: 1;
  transition: transform var(--ui-motion-press-duration) var(--ui-motion-ease-out);
}

.invite-share-button--pressed {
  transform: scale(0.98);
}

.invite-share-button::after {
  border: none;
}

.invite-share-button__text {
  color: var(--ui-color-accent-fg);
  font-size: 30rpx;
  font-weight: 600;
}

.leave-head {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 24rpx 24rpx 20rpx;
}

.leave-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--ui-color-text);
}

.leave-copy {
  font-size: 24rpx;
  font-weight: 400;
  color: var(--ui-color-text-muted);
  line-height: 1.5;
}

/* #ifdef MP-WEIXIN */
/* 微信端复用统一排版尺度；H5 保留原有样式。 */
.team-detail-page { padding: 0 var(--ui-page-padding-inline) var(--ui-page-padding-bottom); }
.team-detail-content { gap: var(--ui-section-gap); }
.state-card { padding: var(--ui-space-9) var(--ui-space-7); }
.state-text { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-medium); }
.page-hero { padding: var(--ui-space-7); }
.hero-row { gap: var(--ui-space-4); }
.hero-badge { font-size: var(--ui-text-display); }
.hero-title { font-size: var(--ui-text-title); line-height: var(--ui-line-height-tight); }
.hero-meta { margin-top: var(--ui-space-2); font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-body); }
.hero-description { margin-top: var(--ui-space-4); font-size: var(--ui-text-body); line-height: var(--ui-line-height-body); font-weight: var(--ui-font-weight-body); }
.fund-entry { gap: var(--ui-space-4); padding: var(--ui-panel-padding); border: var(--ui-panel-border); border-radius: var(--ui-panel-soft-radius); background: var(--ui-panel-soft-bg); box-shadow: var(--ui-panel-shadow); }
.fund-entry__label { font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-medium); letter-spacing: var(--ui-space-1); }
.fund-entry__amount { gap: var(--ui-space-1); margin-top: var(--ui-space-2); }
.fund-entry__symbol { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); }
.fund-entry__value { font-size: var(--ui-text-stat); line-height: var(--ui-line-height-tight); }
.fund-entry__action { gap: var(--ui-space-2); padding: 0 var(--ui-space-5); min-height: var(--ui-control-min-height); border-radius: var(--ui-control-radius); background: var(--ui-control-subtle-bg); }
.fund-entry__action-text { font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-heading); }
.fund-entry__action-arrow { font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-heading); }
.manage-head { gap: var(--ui-space-2); margin-bottom: var(--ui-space-5); }
.manage-title { font-size: var(--ui-text-title); }
.manage-copy { font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-body); }
.invite-hero { gap: var(--ui-space-3); margin-bottom: var(--ui-space-6); }
.invite-kicker { padding: var(--ui-space-1) var(--ui-space-4); }
.invite-kicker__text { font-size: var(--ui-text-sm); font-weight: var(--ui-font-weight-heading); letter-spacing: var(--ui-space-1); }
.invite-title { font-size: var(--ui-text-subtitle); line-height: var(--ui-line-height-tight); }
.invite-copy { font-size: var(--ui-text-sm); line-height: var(--ui-line-height-body); font-weight: var(--ui-font-weight-body); }
.invite-share-button { gap: var(--ui-space-2); padding: 0 var(--ui-space-6); min-height: var(--ui-button-height-md); border: var(--ui-control-border); }
.invite-share-button__text { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); }
.leave-head { gap: var(--ui-space-2); padding: var(--ui-space-6) var(--ui-space-6) var(--ui-space-5); }
.leave-title { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); }
.leave-copy { font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-body); line-height: var(--ui-line-height-body); }
.state-card, .page-hero { padding: var(--ui-panel-padding) 0; border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); box-shadow: var(--ui-panel-shadow); }
.fund-entry--pressed { transform: none; background: var(--ui-control-selected-bg); }
/* #endif */
</style>
