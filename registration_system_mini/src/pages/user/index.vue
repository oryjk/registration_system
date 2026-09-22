<script setup lang="ts">
import { usePageRefresh } from "@/composables/usePageRefresh";
import { ref } from "vue";
import { useAccentTheme } from "@/stores/theme";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import MineProfileHero from "./components/MineProfileHero.vue";
import MineTeamIdentityPanel from "./components/MineTeamIdentityPanel.vue";
import MineStatsGrid from "./components/MineStatsGrid.vue";
import MineMatchSection from "./components/MineMatchSection.vue";
import RunningLoader from "@/components/ui/RunningLoader.vue";
import MineWalletSection from "./components/MineWalletSection.vue";
import MineImpersonationPanel from "./components/MineImpersonationPanel.vue";
import ThemeAccentPicker from "./components/ThemeAccentPicker.vue";
import { useMinePage } from "./useMinePage";

const { themePageStyle } = useAccentTheme();
const toolsExpanded = ref(false);

const {
  currentTeam,
  currentUser,
  teamProfiles,
  shouldHideCreationEntrances,
  isSwitchingTeam,
  myMatches,
  displayName,
  showInitialLoadingState,
  visibleErrorMessage,
  contentStyle,
  currentTeamJoinedDaysLabel,
  mineStats,
  walletSummary,
  settingsEntryVisible,
  impersonating,
  impersonationPanelVisible,
  impersonationCanSwitch,
  impersonationCurrentName,
  impersonationKeyword,
  impersonationResults,
  impersonationSearching,
  impersonationSwitching,
  impersonationRestoring,
  impersonationSearched,
  handleImpersonationSearch,
  handleImpersonationSwitch,
  handleImpersonationRestore,
  confirmDialogVisible,
  confirmDialogState,
  handleConfirmPrimary,
  handleConfirmSecondary,
  handleConfirmClose,
  loadPageData,
  handleEditProfile,
  handleCompleteProfile,
  openSettings,
  handleLogin,
  handleLogout,
  handleClearLocalData,
  handleSwitchTeam,
  openTeamManage,
  openUserMatches,
  openMatchDetail,
  openBilling,
  openNotifications,
  unreadCount,
} = useMinePage();

function handleSessionLoginCompleted() {
  void loadPageData();
}

function openContactDeveloper() {
  uni.navigateTo({ url: "/pages/user/contact-developer/index" });
}

onShow(() => {
  // H5 路由切换时 onShow 可能早于 TabBar 挂载，此时无需隐藏。
  uni.hideTabBar({ animation: false, fail: () => {} });
  void loadPageData();
});

onLoad(() => {
  uni.$on("session:login-completed", handleSessionLoginCompleted);
});

onUnload(() => {
  uni.$off("session:login-completed", handleSessionLoginCompleted);
});
usePageRefresh(loadPageData);
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope mine-page" :style="themePageStyle">
    <AppTabHeader title="我的" />
    <view class="mine-page-content" :style="contentStyle">
      <RunningLoader v-if="showInitialLoadingState" text="正在热身" />
      <template v-else>
        <MineProfileHero :current-user="currentUser" :display-name="displayName" :team-joined-days-label="currentTeamJoinedDaysLabel" @edit-profile="handleEditProfile" @complete-profile="handleCompleteProfile" @login="handleLogin" />
        <view v-if="visibleErrorMessage" class="mine-error-banner"><text>{{ visibleErrorMessage }}</text></view>
        <template v-if="currentUser">
          <MineStatsGrid :items="mineStats" />
          <MineTeamIdentityPanel :current-team="currentTeam" :team-profiles="teamProfiles" :is-switching-team="isSwitchingTeam" @manage-team="openTeamManage" @switch-team="handleSwitchTeam" />
          <MineMatchSection :matches="myMatches" @open-all="openUserMatches" @open-match="openMatchDetail" />
          <MineWalletSection v-if="!shouldHideCreationEntrances" :wallet-summary="walletSummary" @open-billing="openBilling" />
          <view class="mine-services">
            <button class="mine-service" hover-class="mine-service--pressed" @tap="openNotifications">
              <wd-icon name="notification" size="32rpx" /><text class="mine-service-label">消息中心</text><text v-if="unreadCount > 0" class="mine-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</text><wd-icon name="arrow-right" size="26rpx" />
            </button>
            <button class="mine-service" hover-class="mine-service--pressed" @tap="openContactDeveloper">
              <wd-icon name="email" size="32rpx" /><text class="mine-service-label">联系开发者</text><wd-icon name="arrow-right" size="26rpx" />
            </button>
            <button v-if="settingsEntryVisible" class="mine-service" hover-class="mine-service--pressed" @tap="openSettings">
              <wd-icon name="settings" size="32rpx" /><text class="mine-service-label">设置</text><wd-icon name="arrow-right" size="26rpx" />
            </button>
          </view>
        </template>
        <ThemeAccentPicker />
        <view v-if="currentUser && impersonationPanelVisible" class="mine-tools">
          <button class="mine-service" @tap="toolsExpanded = !toolsExpanded" :aria-expanded="toolsExpanded || impersonating">
            <wd-icon name="tool" size="30rpx" /><text class="mine-service-label">身份切换</text><text v-if="impersonating" class="mine-tool-state">正在使用测试身份</text><wd-icon :name="toolsExpanded || impersonating ? 'arrow-up' : 'arrow-down'" size="24rpx" />
          </button>
          <view v-if="toolsExpanded || impersonating" class="mine-tools-content">
            <MineImpersonationPanel v-model:keyword="impersonationKeyword" :impersonating="impersonating" :can-switch="impersonationCanSwitch" :current-name="impersonationCurrentName" :results="impersonationResults" :searching="impersonationSearching" :switching="impersonationSwitching" :restoring="impersonationRestoring" :searched="impersonationSearched" @search="handleImpersonationSearch" @switch="handleImpersonationSwitch" @restore="handleImpersonationRestore" />
          </view>
        </view>
        <view class="mine-account-actions">
          <button class="mine-account-action" @tap="handleClearLocalData">清空本机数据</button>
          <button v-if="currentUser" class="mine-account-action" @tap="handleLogout">退出登录</button>
        </view>
      </template>
      <view class="mine-bottom-spacer" />
      <ConfirmDialog :visible="confirmDialogVisible" :title="confirmDialogState.title" :message="confirmDialogState.message" :highlight="confirmDialogState.highlight" :primary-text="confirmDialogState.primaryText" :secondary-text="confirmDialogState.secondaryText" :primary-tone="confirmDialogState.primaryTone" @primary="handleConfirmPrimary" @secondary="handleConfirmSecondary" @close="handleConfirmClose" />
      <BottomTabBar current="mine" />
    </view>
  </view>
</template>
<style scoped>
.mine-page { position:relative; min-height:100vh; padding:0 28rpx; background:var(--ui-color-page); box-sizing:border-box; }
.mine-page-content { width:100%; max-width:750rpx; margin:0 auto; box-sizing:border-box; }
.mine-error-banner { margin-top:20rpx; padding:20rpx; border-radius:var(--ui-radius-button); background:var(--ui-color-danger-bg); color:var(--ui-color-danger-fg); font-size:24rpx; }
.mine-services,.mine-tools { margin-top:24rpx; border:var(--ui-border-default); border-radius:var(--ui-radius-card); background:var(--ui-color-surface); overflow:hidden; }
.mine-service { display:flex; align-items:center; gap:16rpx; min-height:96rpx; width:100%; margin:0; padding:20rpx 24rpx; background:transparent; color:var(--ui-color-text-muted); border:0; border-radius:0; text-align:left; font-size:26rpx; line-height:1.4; }
.mine-service::after,.mine-account-action::after { border:0; }
.mine-service + .mine-service { border-top:var(--ui-border-default); }
.mine-service-label { flex:1; color:var(--ui-color-text); }
.mine-service--pressed { background:var(--ui-color-neutral-bg); }
.mine-badge { padding:2rpx 12rpx; border-radius:var(--ui-radius-round); font-size:22rpx; background:var(--ui-color-danger-bg); color:var(--ui-color-danger-fg); }
.mine-tool-state { font-size:20rpx; color:var(--ui-color-warning-fg); }
.mine-tools-content { padding:0 16rpx 16rpx; }
.mine-account-actions { display:flex; justify-content:center; gap:32rpx; margin-top:24rpx; }
.mine-account-action { margin:0; padding:16rpx 4rpx; border:0; background:transparent; color:var(--ui-color-text-muted); font-size:22rpx; line-height:1.4; }
.mine-bottom-spacer { height:calc(168rpx + env(safe-area-inset-bottom)); }
/* #ifdef H5 */
.mine-page { width:100%; max-width:750rpx; margin:0 auto; }
.mine-page :deep(.app-tab-header-shell),.mine-page :deep(.custom-tabbar) { left:50%; right:auto; width:100%; max-width:750rpx; transform:translateX(-50%); }
/* #endif */
</style>
