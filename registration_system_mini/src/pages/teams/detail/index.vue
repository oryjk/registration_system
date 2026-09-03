<script setup lang="ts">
import { onShareAppMessage, onShareTimeline } from "@dcloudio/uni-app";
import { useAccentTheme } from "@/stores/theme";
import AppTabHeader from "@/components/AppTabHeader.vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import NeoConfirmDialog from "@/components/neo/NeoConfirmDialog.vue";
import NeoTag from "@/components/neo/NeoTag.vue";
import { TEAM_INVITE_SHARE_IMAGE_URL } from "@/utils/share";
import { useTeamDetailPage } from "./useTeamDetailPage";

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
  leaveDialogVisible,
  handleLeaveTeamClick,
  handleLeaveTeamConfirm,
  membershipLabel,
  loadTeam,
  openTeamManage,
  openTeamFund,
} = useTeamDetailPage();

// 分享邀请：落地到独立邀请页（带邀请码），非成员凭码查看球队并申请加入。
// 缩略图用拉新专用封面：默认截图会带上分享人的队内余额，属敏感信息。
onShareAppMessage(() => ({
  title: team.value ? `邀请你加入球队「${team.value.name}」` : "邀请你加入球队",
  path: `/pages/teams/invite/index?code=${encodeURIComponent(inviteCode.value)}`,
  imageUrl: TEAM_INVITE_SHARE_IMAGE_URL,
}));

onShareTimeline(() => ({
  title: team.value ? `邀请你加入球队「${team.value.name}」` : "邀请你加入球队",
  query: `code=${encodeURIComponent(inviteCode.value)}`,
}));
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="team-detail-page" :style="pageStyle">
    <AppTabHeader :title="team?.name || '球队'" showBack />

    <view class="team-detail-content">
      <view v-if="errorMessage" class="state-card" @tap="loadTeam">
        <text class="state-text">{{ errorMessage }}，点击重试</text>
      </view>
      <view v-else-if="isLoading && !team" class="state-card">
        <text class="state-text">正在加载球队信息...</text>
      </view>

      <template v-else-if="team">
        <view class="page-hero">
          <view class="hero-row">
            <view class="hero-badge">
              <image v-if="logoUrl" class="hero-badge__logo" :src="logoUrl" mode="aspectFill" />
              <text v-else>{{ team.name.slice(0, 1) || "队" }}</text>
            </view>
            <view class="hero-copy">
              <text class="hero-title">{{ team.name }}</text>
              <text class="hero-meta">{{ roleLabel }} · 信用分 {{ team.credit_score }}</text>
              <text v-if="createdLabel" class="hero-meta">创建于 {{ createdLabel }}</text>
            </view>
            <NeoTag :tone="team.is_vip ? 'lime' : 'amber'" size="lg">{{ membershipLabel }}</NeoTag>
          </view>
          <text v-if="description" class="hero-description">{{ description }}</text>
        </view>

        <!-- 队费下放子页后的轻量入口：展示余额，点击进入队费缴纳页。 -->
        <view class="fund-entry" hover-class="fund-entry--pressed" @tap="openTeamFund">
          <view class="fund-entry__main">
            <text class="fund-entry__label">队费余额</text>
            <view class="fund-entry__amount">
              <text class="fund-entry__symbol">¥</text>
              <text class="fund-entry__value">{{ balanceLabel }}</text>
            </view>
          </view>
          <view class="fund-entry__action">
            <text class="fund-entry__action-text">去缴纳</text>
            <text class="fund-entry__action-arrow">→</text>
          </view>
        </view>

        <!-- 球队管理入口仅对队长/领队有意义，普通队员不展示。 -->
        <NeoSurface v-if="canManage" variant="raised" custom-class="manage-card">
          <view class="manage-head">
            <text class="manage-title">球队管理</text>
            <text class="manage-copy">资料、队员与比赛出勤管理</text>
          </view>
          <NeoButton variant="outline" block @click="openTeamManage">
            进入球队管理
          </NeoButton>
        </NeoSurface>

        <!-- 邀请球友（拉新）：仅队长/领队展示；open-type=share 触发与右上角菜单相同的分享配置。 -->
        <NeoSurface v-if="canManage" variant="dark" custom-class="invite-card">
          <view class="invite-hero">
            <view class="invite-kicker">
              <text class="invite-kicker__text">人越多，越好玩！</text>
            </view>
            <text class="invite-title">邀请球友加入</text>
            <text class="invite-copy">分享邀请卡片给球友，点开即可申请加入{{ team.name }}，7 天内有效。</text>
          </view>
          <button class="invite-share-button" open-type="share" hover-class="invite-share-button--pressed">
            <text class="invite-share-button__text">分享邀请，拉球友入队</text>
            <text class="invite-share-button__arrow">↗</text>
          </button>
        </NeoSurface>

        <!-- 退出球队：独立卡片，仅非队长的在队成员可见；余额不为零在入口即拦截，后端同样校验。 -->
        <NeoSurface v-if="canLeaveTeam" variant="raised" custom-class="leave-card">
          <view class="leave-head">
            <text class="leave-title">退出球队</text>
            <text class="leave-copy">退出后不再参与本球队的比赛与报名；队费余额需为 0 才能退出。</text>
          </view>
          <NeoButton variant="danger" block @click="handleLeaveTeamClick">
            退出球队
          </NeoButton>
        </NeoSurface>
      </template>
    </view>

    <!-- 退出球队：二次确认；余额不为零在入口即拦截，后端同样校验。 -->
    <NeoConfirmDialog
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
.team-detail-page {
  min-height: 100vh;
  padding: 0 28rpx 96rpx;
  background: var(--neo-color-page);
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
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
}

.state-card {
  padding: 40rpx 28rpx;
  text-align: center;
}

.state-text {
  color: var(--neo-color-text-muted);
  font-size: 28rpx;
  font-weight: 800;
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
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-hero);
  color: var(--neo-color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: 950;
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
  color: var(--neo-color-text);
  font-size: 38rpx;
  line-height: 1.2;
  font-weight: 950;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-meta {
  display: block;
  margin-top: 8rpx;
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 700;
}

.hero-description {
  display: block;
  margin-top: 18rpx;
  color: var(--neo-color-text-muted);
  font-size: 25rpx;
  line-height: 1.55;
  font-weight: 700;
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
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.fund-entry__amount {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
  margin-top: 8rpx;
}

.fund-entry__symbol {
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 900;
}

.fund-entry__value {
  color: var(--neo-color-text);
  font-size: 46rpx;
  line-height: 1.1;
  font-weight: 950;
}

.fund-entry__action {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-accent);
  flex-shrink: 0;
}

.fund-entry__action-text {
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
}

.fund-entry__action-arrow {
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
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
  color: var(--neo-color-text);
  font-size: 32rpx;
  font-weight: 950;
}

.manage-copy {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 700;
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

.leave-card {
  margin-top: 0;
}

/* 拉新卡片：深底 hero 卡片 + 青柠错位阴影，与 team-manage-hero 同一 neo 语言。 */
:deep(.invite-card) {
  padding: 28rpx;
  background: var(--neo-color-hero);
  box-shadow: 8rpx 8rpx 0 var(--neo-color-accent);
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
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-accent);
}

.invite-kicker__text {
  color: var(--neo-color-text);
  font-size: 22rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
}

.invite-title {
  color: var(--neo-color-text-inverse);
  font-size: 40rpx;
  font-weight: 950;
  line-height: 1.2;
}

.invite-copy {
  color: rgba(255, 255, 255, 0.72);
  font-size: 24rpx;
  line-height: 1.5;
  font-weight: 700;
}

/* open-type=share 只能用原生 button 触发，这里把 button 抹成 neo 按钮外观。 */
.invite-share-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  width: 100%;
  min-height: 88rpx;
  margin: 0;
  padding: 0 24rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-accent);
  box-shadow: 4rpx 4rpx 0 var(--neo-color-surface);
  box-sizing: border-box;
  line-height: 1;
}

.invite-share-button--pressed {
  transform: translate(4rpx, 4rpx);
  box-shadow: none;
}

.invite-share-button::after {
  border: none;
}

.invite-share-button__text {
  color: var(--neo-color-text);
  font-size: 30rpx;
  font-weight: 900;
}

.invite-share-button__arrow {
  color: var(--neo-color-text);
  font-size: 34rpx;
  font-weight: 900;
}

.leave-head {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 24rpx 24rpx 20rpx;
}

.leave-title {
  font-size: 30rpx;
  font-weight: 900;
  color: var(--neo-color-text);
}

.leave-copy {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--neo-color-text-muted);
  line-height: 1.5;
}
</style>
