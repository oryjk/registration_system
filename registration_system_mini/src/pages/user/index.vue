<script setup lang="ts">
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import MineProfileHero from "./components/MineProfileHero.vue";
import MineTeamIdentityPanel from "./components/MineTeamIdentityPanel.vue";
import MineStatsGrid from "./components/MineStatsGrid.vue";
import MineMatchSection from "./components/MineMatchSection.vue";
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
  myMatches,
  displayName,
  showInitialLoadingState,
  visibleErrorMessage,
  contentStyle,
  currentTeamJoinedDaysLabel,
  mineStats,
  walletSummary,
  settingsEntryVisible,
  loadPageData,
  handleEditProfile,
  handleCompleteProfile,
  openSettings,
  handleLogin,
  handleLogout,
  handleSwitchTeam,
  openTeamManage,
  openUserMatches,
  openMatchDetail,
  openBilling,
} = useMinePage();

function handleSessionLoginCompleted() {
  void loadPageData();
}

function openContactDeveloper() {
  uni.navigateTo({ url: "/pages/user/contact-developer/index" });
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

          <!-- 联系开发者入口：占据原“账户与服务”位置，全员可见。 -->
          <view
            class="mine-settings-entry"
            hover-class="mine-settings-entry--pressed"
            :hover-stay-time="100"
            @click="openContactDeveloper"
          >
            <text class="mine-settings-entry__label">联系开发者</text>
            <text class="mine-settings-entry__arrow">›</text>
          </view>

          <!-- 设置入口只对产品负责人账号显示；验证/运营工具统一收拢在设置页。 -->
          <view
            v-if="settingsEntryVisible"
            class="mine-settings-entry"
            hover-class="mine-settings-entry--pressed"
            :hover-stay-time="100"
            @click="openSettings"
          >
            <text class="mine-settings-entry__label">设置</text>
            <text class="mine-settings-entry__arrow">›</text>
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

/* 设置入口：负责人账号专属，样式与页面卡片层级一致。 */
.mine-settings-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 92rpx;
  margin-top: 26rpx;
  padding: 0 26rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
  box-sizing: border-box;
}

.mine-settings-entry--pressed {
  opacity: 0.72;
}

.mine-settings-entry__label {
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 900;
}

.mine-settings-entry__arrow {
  color: var(--neo-color-text-muted);
  font-size: 40rpx;
  font-weight: 900;
  line-height: 1;
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
