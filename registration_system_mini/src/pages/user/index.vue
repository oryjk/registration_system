<script setup lang="ts">
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import MineProfileHero from "./components/MineProfileHero.vue";
import MineTeamIdentityPanel from "./components/MineTeamIdentityPanel.vue";
import MineStatsGrid from "./components/MineStatsGrid.vue";
import MineMatchSection from "./components/MineMatchSection.vue";
import MineServiceGrid from "./components/MineServiceGrid.vue";
import MineSkeleton from "./components/MineSkeleton.vue";
import MineWalletSection from "./components/MineWalletSection.vue";
import { useMinePage } from "./useMinePage";

const {
  currentTeam,
  currentUser,
  teamProfiles,
  shouldHideCreationEntrances,
  isLoading,
  isSwitchingTeam,
  isPayingMembership,
  myMatches,
  displayName,
  showInitialLoadingState,
  visibleErrorMessage,
  messageSummary,
  contentStyle,
  creditCardSummary,
  currentTeamJoinedDaysLabel,
  mineStats,
  walletSummary,
  debugClearProfileEnabled,
  loadPageData,
  handleEditProfile,
  handleCompleteProfile,
  handleDebugClearProfile,
  handleLogin,
  handleLogout,
  handleSwitchTeam,
  openTeamManage,
  openNotifications,
  openUserMatches,
  openMatchDetail,
  openBilling,
  handleMembershipRenewal,
} = useMinePage();

function handleSessionLoginCompleted() {
  void loadPageData();
}

onShow(() => {
  uni.hideTabBar({ animation: false });
  void loadPageData();
});

onLoad(() => {
  uni.$on("session:login-completed", handleSessionLoginCompleted);
});

onUnload(() => {
  uni.$off("session:login-completed", handleSessionLoginCompleted);
});
</script>

<template>
  <view class="mine-page">
    <AppTabHeader title="我的" />
    <view class="mine-page-content" :style="contentStyle">
      <MineSkeleton v-if="showInitialLoadingState" />

      <template v-else>
        <MineProfileHero
          :current-user="currentUser"
          :display-name="displayName"
          :team-joined-days-label="currentTeamJoinedDaysLabel"
          @edit-profile="handleEditProfile"
          @complete-profile="handleCompleteProfile"
          @login="handleLogin"
          @logout="handleLogout"
        />

        <view v-if="visibleErrorMessage" class="mine-error-banner">
          <text class="mine-error-banner__label">数据加载失败</text>
          <text class="mine-error-banner__message">{{ visibleErrorMessage }}</text>
        </view>

        <template v-if="currentUser">
          <MineTeamIdentityPanel
            :current-team="currentTeam"
            :team-profiles="teamProfiles"
            :is-switching-team="isSwitchingTeam"
            @manage-team="openTeamManage"
            @switch-team="handleSwitchTeam"
          />

          <MineStatsGrid :items="mineStats" />

          <MineMatchSection
            :matches="myMatches"
            @open-all="openUserMatches"
            @open-match="openMatchDetail"
          />

          <MineWalletSection
            v-if="!shouldHideCreationEntrances"
            :wallet-summary="walletSummary"
            @open-billing="openBilling"
          />

          <MineServiceGrid
            :current-team="currentTeam"
            :message-summary="messageSummary"
            :credit-card-summary="creditCardSummary"
            :is-paying-membership="isPayingMembership"
            @open-notifications="openNotifications"
            @renew-membership="handleMembershipRenewal"
          />

          <view v-if="debugClearProfileEnabled" class="mine-debug-tools">
            <view
              class="mine-debug-tools__button"
              hover-class="mine-debug-tools__button--pressed"
              :hover-stay-time="100"
              @click="handleDebugClearProfile"
            >
              <text class="mine-debug-tools__label">清除头像和昵称（验证入口）</text>
            </view>
            <text class="mine-debug-tools__hint">由管理端「系统设置」开关控制，仅用于验证资料完善引导</text>
          </view>
        </template>
      </template>

      <view class="mine-bottom-spacer" />
      <BottomTabBar current="mine" />
    </view>
  </view>
</template>

<style scoped>
.mine-page {
  position: relative;
  min-height: 100vh;
  padding: 0 28rpx 0;
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.mine-page-content {
  position: relative;
  width: 100%;
  max-width: 900rpx;
  margin: 0 auto;
  box-sizing: border-box;
}

.mine-error-banner {
  margin-top: 22rpx;
  padding: 18rpx 20rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-danger-soft);
  box-shadow: 6rpx 6rpx 0 var(--neo-color-text);
}

.mine-error-banner__label,
.mine-error-banner__message {
  display: block;
}

.mine-error-banner__label {
  color: var(--neo-color-text);
  font-size: 23rpx;
  font-weight: 900;
}

.mine-error-banner__message {
  margin-top: 6rpx;
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.45;
  word-break: break-word;
}

.mine-bottom-spacer {
  height: calc(168rpx + env(safe-area-inset-bottom));
}

.mine-debug-tools {
  margin-top: 26rpx;
}

.mine-debug-tools__button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 76rpx;
  padding: 0 24rpx;
  border: 2rpx dashed var(--neo-color-text-muted);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-muted);
  box-sizing: border-box;
}

.mine-debug-tools__button--pressed {
  opacity: 0.7;
}

.mine-debug-tools__label {
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.35;
}

.mine-debug-tools__hint {
  display: block;
  margin-top: 10rpx;
  color: var(--neo-color-text-muted);
  font-size: 20rpx;
  font-weight: 700;
  line-height: 1.4;
  text-align: center;
}

/* #ifdef H5 */
.mine-page {
  width: 100%;
  max-width: 750rpx;
  margin: 0 auto;
}

.mine-page :deep(.app-tab-header-shell),
.mine-page :deep(.custom-tabbar) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */
</style>
