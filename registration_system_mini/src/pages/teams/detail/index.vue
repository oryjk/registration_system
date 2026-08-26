<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import AppTabHeader from "@/components/AppTabHeader.vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import NeoConfirmDialog from "@/components/neo/NeoConfirmDialog.vue";
import NeoTag from "@/components/neo/NeoTag.vue";
import { useTeamDetailPage } from "./useTeamDetailPage";

const { themePageStyle } = useAccentTheme();

const {
  pageStyle,
  team,
  isLoading,
  errorMessage,
  paying,
  amountInput,
  amountError,
  balanceLabel,
  roleLabel,
  canManage,
  canLeaveTeam,
  leaveDialogVisible,
  handleLeaveTeamClick,
  handleLeaveTeamConfirm,
  totalPriceLabel,
  membershipLabel,
  loadTeam,
  openTeamManage,
  handleMembershipPayment,
} = useTeamDetailPage();
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
            <view class="hero-badge">{{ team.name.slice(0, 1) || "队" }}</view>
            <view class="hero-copy">
              <text class="hero-title">{{ team.name }}</text>
              <text class="hero-meta">{{ roleLabel }} · 信用分 {{ team.credit_score }}</text>
            </view>
            <NeoTag :tone="team.is_vip ? 'lime' : 'amber'" size="lg">{{ membershipLabel }}</NeoTag>
          </view>
        </view>

        <view class="recharge-card">
          <view class="balance-hero">
            <text class="balance-hero-label">我的队内余额</text>
            <view class="balance-hero-amount">
              <text class="balance-hero-symbol">¥</text>
              <text class="balance-hero-value">{{ balanceLabel }}</text>
            </view>
            <text class="balance-hero-copy">队费充值计入你在本队的个人账户</text>
          </view>
          <view class="recharge-amount">
            <input
              v-model="amountInput"
              class="recharge-input"
              type="digit"
              placeholder="输入缴纳金额（元）"
            />
            <text v-if="amountError" class="recharge-error">{{ amountError }}</text>
          </view>
          <view class="recharge-total">
            <text class="recharge-total-label">应付</text>
            <text class="recharge-total-value">{{ totalPriceLabel }}</text>
          </view>
          <NeoButton
            block
            :loading="paying"
            :disabled="paying"
            @click="handleMembershipPayment"
          >
            {{ paying ? "支付中..." : canManage ? "微信支付缴纳队费" : "仅队长或领队可缴纳" }}
          </NeoButton>
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
.recharge-card {
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

.recharge-card {
  padding: 28rpx;
}

.balance-hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6rpx;
  padding: 24rpx;
  margin-bottom: 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-success);
}

.balance-hero-label {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.balance-hero-amount {
  display: flex;
  align-items: baseline;
  gap: 6rpx;
}

.balance-hero-symbol {
  color: var(--neo-color-text);
  font-size: 34rpx;
  font-weight: 900;
}

.balance-hero-value {
  color: var(--neo-color-text);
  font-size: 64rpx;
  line-height: 1.1;
  font-weight: 950;
}

.balance-hero-copy {
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
}

.recharge-amount {
  margin-top: 22rpx;
}

.recharge-input {
  height: 88rpx;
  padding: 0 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 30rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.recharge-error {
  display: block;
  margin-top: 10rpx;
  color: var(--neo-color-danger);
  font-size: 22rpx;
  font-weight: 700;
}

.recharge-total {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin: 22rpx 4rpx;
}

.recharge-total-label {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 800;
}

.recharge-total-value {
  color: var(--neo-color-text);
  font-size: 44rpx;
  font-weight: 950;
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
</style>

.leave-card {
  margin-top: 0;
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
