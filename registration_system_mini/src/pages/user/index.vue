<script setup lang="ts">
// #ifdef MP-WEIXIN
import AppIcon from "@/components/ui/AppIcon.vue";
// #endif
import { usePullRefresh } from "@/composables/usePullRefresh";
import { APP_SCROLL_CONTROLLER, createAppScrollAnchor } from "@/components/appScroll";
import { provide, ref } from "vue";
import { useAccentTheme } from "@/stores/theme";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppPullScrollView from "@/components/AppPullScrollView.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import { tabBarMotion } from "@/components/tabBarMotion";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import MineProfileHero from "./components/MineProfileHero.vue";
import MineTeamIdentityPanel from "./components/MineTeamIdentityPanel.vue";
import MineStatsGrid from "./components/MineStatsGrid.vue";
import MineMatchSection from "./components/MineMatchSection.vue";
import RunningLoader from "@/components/ui/RunningLoader.vue";
import MineWalletSection from "./components/MineWalletSection.vue";
import MineImpersonationPanel from "./components/MineImpersonationPanel.vue";
// #ifndef MP-WEIXIN
import ThemeAccentPicker from "./components/ThemeAccentPicker.vue";
// #endif
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

function openHelp() {
  uni.navigateTo({ url: "/pages/user/help/index" });
}

function openChanlun() {
  // #ifdef MP-WEIXIN
  if (shouldHideCreationEntrances.value) return;
  // #endif
  uni.navigateTo({ url: "/pages/chanlun/index" });
}

onShow(() => {
  tabBarMotion.show("mine");
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
// scroll-view 自定义下拉：页面本体不滚动，固定 header 不随下拉拖动。
const { refreshing, handleRefresherRefresh } = usePullRefresh(loadPageData);
// 滚动锚点提升到页面根：AppTabHeader 与滚动容器是兄弟节点，provide 必须来自页面。
const { anchor: appScrollAnchor, controller: appScrollController } = createAppScrollAnchor();
provide(APP_SCROLL_CONTROLLER, appScrollController);
</script>

<template>
  <!-- 页面本体锁定不滚动（滚动在 AppPullScrollView 内），header 不随下拉移动。 -->
  <page-meta :page-style="`${themePageStyle};overflow:hidden`" />
  <view class="app-theme-scope ui-card-page mine-page" :style="themePageStyle">
    <AppTabHeader title="我的" />
    <AppPullScrollView ref="appScrollAnchor" :refreshing="refreshing" @refresh="handleRefresherRefresh">
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
        </template>
          <view class="mine-services ui-card-list">
            <button class="mine-service ui-list-row" hover-class="mine-service--pressed" @tap="openHelp">
              <!-- #ifdef MP-WEIXIN -->
              <AppIcon name="circle-help" />
              <!-- #endif -->
              <!-- #ifndef MP-WEIXIN -->
              <text class="mine-help-icon">?</text>
              <!-- #endif -->
              <text class="mine-service-label">使用帮助</text>
              <!-- #ifdef MP-WEIXIN -->
              <AppIcon name="chevron-right" size="var(--ui-icon-sm)" tone="muted" />
              <!-- #endif -->
              <!-- #ifndef MP-WEIXIN -->
              <wd-icon name="arrow-right" size="26rpx" />
              <!-- #endif -->
            </button>
            <!-- #ifdef MP-WEIXIN -->
            <button v-if="!shouldHideCreationEntrances" class="mine-service ui-list-row" hover-class="mine-service--pressed" @tap="openChanlun">
              <AppIcon name="chart-column" />
              <text class="mine-service-label">缠观行情</text>
              <AppIcon name="chevron-right" size="var(--ui-icon-sm)" tone="muted" />
            </button>
            <!-- #endif -->
            <button v-if="currentUser" class="mine-service ui-list-row" hover-class="mine-service--pressed" @tap="openNotifications">
              <!-- #ifdef MP-WEIXIN -->
              <AppIcon name="bell" size="var(--ui-icon-md)" />
              <!-- #endif -->
              <!-- #ifndef MP-WEIXIN -->
              <wd-icon name="notification" size="32rpx" />
              <!-- #endif -->
              <text class="mine-service-label">消息中心</text><text v-if="unreadCount > 0" class="mine-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</text>
              <!-- #ifdef MP-WEIXIN -->
              <AppIcon name="chevron-right" size="var(--ui-icon-sm)" tone="muted" />
              <!-- #endif -->
              <!-- #ifndef MP-WEIXIN -->
              <wd-icon name="arrow-right" size="26rpx" />
              <!-- #endif -->
            </button>
            <button v-if="currentUser" class="mine-service ui-list-row" hover-class="mine-service--pressed" @tap="openContactDeveloper">
              <!-- #ifdef MP-WEIXIN -->
              <AppIcon name="mail" size="var(--ui-icon-md)" />
              <!-- #endif -->
              <!-- #ifndef MP-WEIXIN -->
              <wd-icon name="email" size="32rpx" />
              <!-- #endif -->
              <text class="mine-service-label">联系开发者</text>
              <!-- #ifdef MP-WEIXIN -->
              <AppIcon name="chevron-right" size="var(--ui-icon-sm)" tone="muted" />
              <!-- #endif -->
              <!-- #ifndef MP-WEIXIN -->
              <wd-icon name="arrow-right" size="26rpx" />
              <!-- #endif -->
            </button>
            <button v-if="currentUser && settingsEntryVisible" class="mine-service ui-list-row" hover-class="mine-service--pressed" @tap="openSettings">
              <!-- #ifdef MP-WEIXIN -->
              <AppIcon name="settings" size="var(--ui-icon-md)" />
              <!-- #endif -->
              <!-- #ifndef MP-WEIXIN -->
              <wd-icon name="settings" size="32rpx" />
              <!-- #endif -->
              <text class="mine-service-label">设置</text>
              <!-- #ifdef MP-WEIXIN -->
              <AppIcon name="chevron-right" size="var(--ui-icon-sm)" tone="muted" />
              <!-- #endif -->
              <!-- #ifndef MP-WEIXIN -->
              <wd-icon name="arrow-right" size="26rpx" />
              <!-- #endif -->
            </button>
          </view>
        <!-- #ifndef MP-WEIXIN -->
        <ThemeAccentPicker />
        <!-- #endif -->
        <view v-if="currentUser && impersonationPanelVisible" class="mine-tools ui-card-list">
          <button class="mine-service ui-list-row" @tap="toolsExpanded = !toolsExpanded" :aria-expanded="toolsExpanded || impersonating">
            <!-- #ifdef MP-WEIXIN -->
            <AppIcon name="wrench" size="var(--ui-icon-md)" />
            <!-- #endif -->
            <!-- #ifndef MP-WEIXIN -->
            <wd-icon name="tool" size="30rpx" />
            <!-- #endif -->
            <text class="mine-service-label">身份切换</text><text v-if="impersonating" class="mine-tool-state">正在使用测试身份</text>
            <!-- #ifdef MP-WEIXIN -->
            <AppIcon :name="toolsExpanded || impersonating ? 'chevron-up' : 'chevron-down'" size="var(--ui-icon-sm)" tone="muted" />
            <!-- #endif -->
            <!-- #ifndef MP-WEIXIN -->
            <wd-icon :name="toolsExpanded || impersonating ? 'arrow-up' : 'arrow-down'" size="24rpx" />
            <!-- #endif -->
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
      </view>
    </AppPullScrollView>
      <ConfirmDialog :visible="confirmDialogVisible" :title="confirmDialogState.title" :message="confirmDialogState.message" :highlight="confirmDialogState.highlight" :primary-text="confirmDialogState.primaryText" :secondary-text="confirmDialogState.secondaryText" :primary-tone="confirmDialogState.primaryTone" @primary="handleConfirmPrimary" @secondary="handleConfirmSecondary" @close="handleConfirmClose" />
      <BottomTabBar current="mine" />
  </view>
</template>
<style scoped>
@import "@/styles/page-surfaces.css";
@import "@/styles/list-surfaces.css";
.mine-page { position:relative; min-height:100vh; padding:0; background:var(--ui-color-page); box-sizing:border-box; }
.mine-page-content { padding:0 28rpx; width:100%; max-width:750rpx; margin:0 auto; box-sizing:border-box; }
.mine-error-banner { margin-top:20rpx; padding:20rpx; border-radius:var(--ui-radius-button); background:var(--ui-color-danger-bg); color:var(--ui-color-danger-fg); font-size:24rpx; }
.mine-services,.mine-tools { margin-top:24rpx; border:var(--ui-border-default); border-radius:var(--ui-radius-card); background:var(--ui-color-surface); overflow:hidden; }
.mine-service { display:flex; align-items:center; gap:16rpx; min-height:96rpx; width:100%; margin:0; padding:20rpx 24rpx; background:transparent; color:var(--ui-color-text-muted); border:0; border-radius:0; text-align:left; font-size:26rpx; line-height:1.4; }
.mine-service::after,.mine-account-action::after { border:0; }
.mine-service + .mine-service { border-top:var(--ui-border-default); }
.mine-service-label { flex:1; color:var(--ui-color-text); }
.mine-help-icon { width:32rpx; text-align:center; font-size:30rpx; font-weight:var(--ui-font-weight-heading); }
.mine-service--pressed { background:var(--ui-color-neutral-bg); }
.mine-badge { padding:2rpx 12rpx; border-radius:var(--ui-radius-round); font-size:22rpx; background:var(--ui-color-danger-bg); color:var(--ui-color-danger-fg); }
.mine-tool-state { font-size:20rpx; color:var(--ui-color-warning-fg); }
.mine-tools-content { padding:0 16rpx 16rpx; }
.mine-account-actions { display:flex; justify-content:center; gap:32rpx; margin-top:24rpx; }
.mine-account-action { margin:0; padding:16rpx 4rpx; border:0; background:transparent; color:var(--ui-color-text-muted); font-size:22rpx; line-height:1.4; }
.mine-bottom-spacer { height:var(--ui-tabbar-clearance); }
/* #ifdef H5 */
.mine-page { width:100%; max-width:750rpx; margin:0 auto; }
.mine-page :deep(.app-tab-header-shell) { left:50%; right:auto; width:100%; max-width:750rpx; transform:translateX(-50%); }
/* #endif */

/* #ifdef MP-WEIXIN */
.mine-page-content { padding: 0 var(--ui-page-padding-inline); }
.mine-services,.mine-tools { margin-top: var(--ui-card-gap); border: var(--ui-panel-border); border-radius: var(--ui-card-radius); background: var(--ui-card-bg); }
.mine-service { gap: var(--ui-list-row-gap); min-height: var(--ui-list-row-min-height); padding: var(--ui-list-row-padding) 0; font-size: var(--ui-text-label); }
.mine-service + .mine-service { border-top: var(--ui-list-divider); }
.mine-service--pressed { background: var(--ui-control-subtle-bg); }
.mine-tools-content { padding: 0 0 var(--ui-space-4); --ui-content-surface-radius: var(--ui-panel-radius); --ui-content-surface-shadow: var(--ui-panel-shadow); }
.mine-account-actions { gap: var(--ui-space-8); margin-top: var(--ui-section-gap); }
.mine-account-action { padding: var(--ui-space-4) var(--ui-space-1); font-size: var(--ui-text-sm); }
.mine-service-label { min-width: 0; font-size: var(--ui-text-subtitle); overflow-wrap: anywhere; }
.mine-tool-state { flex-shrink: 0; font-size: var(--ui-text-xs); }
.mine-badge { flex-shrink: 0; font-variant-numeric: tabular-nums; }
.mine-account-action { color: var(--ui-color-text-secondary); }
/* #endif */
</style>
