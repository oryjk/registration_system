<script setup lang="ts">
import { computed, ref } from "vue";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { useTeamContext } from "@/stores/teamContext";
import { useMiniReviewStatus } from "@/stores/miniReview";
import homeIconUrl from "@/static/tab-png/home.png";
import homeActiveIconUrl from "@/static/tab-png/home-active.png";
import challengeIconUrl from "@/static/tab-png/challenge.png";
import challengeActiveIconUrl from "@/static/tab-png/challenge-active.png";
import statsIconUrl from "@/static/tab-png/stats.png";
import statsActiveIconUrl from "@/static/tab-png/stats-active.png";
import userIconUrl from "@/static/tab-png/user.png";
import userActiveIconUrl from "@/static/tab-png/user-active.png";

type TabKey = "home" | "challenge" | "stats" | "mine";

const props = defineProps<{
  current: TabKey;
}>();

const { currentTeam } = useTeamContext();
const { unreadCount } = useNotificationCenter();
const { shouldHideCreationEntrances } = useMiniReviewStatus();
const isOpen = ref(false);
const shouldShowCreateEntry = computed(() => !shouldHideCreationEntrances.value);

const items: Array<{
  key: TabKey;
  label: string;
  path: string;
  icon: string;
  activeIcon: string;
}> = [
  {
    key: "home",
    label: "首页",
    path: "/pages/home/index",
    icon: homeIconUrl,
    activeIcon: homeActiveIconUrl,
  },
  {
    key: "challenge",
    label: "约队",
    path: "/pages/activities/index",
    icon: challengeIconUrl,
    activeIcon: challengeActiveIconUrl,
  },
  {
    key: "stats",
    label: "统计",
    path: "/pages/teams/index",
    icon: statsIconUrl,
    activeIcon: statsActiveIconUrl,
  },
  {
    key: "mine",
    label: "我的",
    path: "/pages/user/index",
    icon: userIconUrl,
    activeIcon: userActiveIconUrl,
  },
];

function switchTab(path: string) {
  uni.switchTab({ url: path });
}

function openSheet() {
  if (!shouldShowCreateEntry.value) return;
  isOpen.value = !isOpen.value;
}

function closeSheet() {
  isOpen.value = false;
}

function handleCreateMatch() {
  closeSheet();
  if (!currentTeam.value) {
    uni.showToast({
      title: "请先完成登录并加入球队",
      icon: "none",
    });
    return;
  }

  if (!currentTeam.value.canManageTeam) {
    uni.showToast({
      title: "只有队长或领队可以创建比赛",
      icon: "none",
    });
    return;
  }

  uni.navigateTo({
    url: "/pages/matches/create/index",
  });
}

function handleCreateTeam() {
  closeSheet();
  // 创建球队对所有用户开放（一人可创建多支球队），直达独立的创建页。
  uni.navigateTo({
    url: "/pages/teams/create/index",
  });
}

function handleCreateIndividualChallenge() {
  closeSheet();
  // 散人约球：无球队概念的独立发布页（online_pickup，POST /matches）。
  uni.navigateTo({
    url: "/pages/challenges/create-individual/index",
  });
}
</script>

<template>
  <view class="custom-tabbar-shell">
    <view :class="['custom-tabbar', shouldShowCreateEntry ? '' : 'custom-tabbar-no-create']">
      <template v-if="shouldShowCreateEntry">
        <view
          v-for="item in items.slice(0, 2)"
          :key="item.key"
          :class="['custom-tab-item', props.current === item.key ? 'custom-tab-item-active' : '']"
          @tap="switchTab(item.path)"
        >
          <view class="custom-tab-icon-shell">
            <image
              class="custom-tab-icon-image"
              :src="props.current === item.key ? item.activeIcon : item.icon"
              mode="aspectFit"
            />
            <view v-if="item.key === 'mine' && unreadCount > 0" class="custom-tab-badge">
              {{ unreadCount > 99 ? "99+" : unreadCount }}
            </view>
          </view>
          <text class="custom-tab-label">{{ item.label }}</text>
        </view>

        <view class="custom-tab-item custom-tab-item-center">
          <view :class="['custom-tab-plus', isOpen ? 'custom-tab-plus-open' : '']" @tap="openSheet">
            <text class="custom-tab-plus-symbol">{{ isOpen ? "×" : "+" }}</text>
          </view>
          <text class="custom-tab-label custom-tab-label-active">创建</text>
        </view>

        <view
          v-for="item in items.slice(2)"
          :key="item.key"
          :class="['custom-tab-item', props.current === item.key ? 'custom-tab-item-active' : '']"
          @tap="switchTab(item.path)"
        >
          <view class="custom-tab-icon-shell">
            <image
              class="custom-tab-icon-image"
              :src="props.current === item.key ? item.activeIcon : item.icon"
              mode="aspectFit"
            />
            <view v-if="item.key === 'mine' && unreadCount > 0" class="custom-tab-badge">
              {{ unreadCount > 99 ? "99+" : unreadCount }}
            </view>
          </view>
          <text class="custom-tab-label">{{ item.label }}</text>
        </view>
      </template>

      <template v-else>
        <view
          v-for="item in items"
          :key="item.key"
          :class="['custom-tab-item', props.current === item.key ? 'custom-tab-item-active' : '']"
          @tap="switchTab(item.path)"
        >
          <view class="custom-tab-icon-shell">
            <image
              class="custom-tab-icon-image"
              :src="props.current === item.key ? item.activeIcon : item.icon"
              mode="aspectFit"
            />
            <view v-if="item.key === 'mine' && unreadCount > 0" class="custom-tab-badge">
              {{ unreadCount > 99 ? "99+" : unreadCount }}
            </view>
          </view>
          <text class="custom-tab-label">{{ item.label }}</text>
        </view>
      </template>
    </view>

    <view v-if="shouldShowCreateEntry" :class="['create-menu-overlay', isOpen ? 'create-menu-overlay-open' : '']" @tap="closeSheet">
      <view class="create-menu-backdrop" />
      <view class="create-menu-actions" @tap.stop>
        <view class="create-menu-action create-menu-action-left" @tap="handleCreateMatch">
          <view class="create-menu-action-button">
            <view class="create-menu-action-icon create-menu-icon-match">
              <view class="create-menu-field-line" />
              <view class="create-menu-field-circle" />
            </view>
          </view>
          <text class="create-menu-action-label">创建比赛</text>
        </view>

        <view class="create-menu-action create-menu-action-center" @tap="handleCreateIndividualChallenge">
          <view class="create-menu-action-button">
            <view class="create-menu-action-icon create-menu-icon-ball">
              <view class="create-menu-ball-panel create-menu-ball-panel-top" />
              <view class="create-menu-ball-panel create-menu-ball-panel-left" />
              <view class="create-menu-ball-panel create-menu-ball-panel-right" />
            </view>
          </view>
          <text class="create-menu-action-label">创建散人约球</text>
        </view>

        <view class="create-menu-action create-menu-action-right" @tap="handleCreateTeam">
          <view class="create-menu-action-button">
            <view class="create-menu-action-icon create-menu-icon-team">
              <view class="create-menu-person create-menu-person-side">
                <view class="create-menu-person-head" />
                <view class="create-menu-person-body" />
              </view>
              <view class="create-menu-person create-menu-person-main">
                <view class="create-menu-person-head" />
                <view class="create-menu-person-body" />
              </view>
              <view class="create-menu-person create-menu-person-side">
                <view class="create-menu-person-head" />
                <view class="create-menu-person-body" />
              </view>
            </view>
          </view>
          <text class="create-menu-action-label">创建球队</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.custom-tabbar-shell {
  pointer-events: none;
}

.custom-tabbar {
  pointer-events: auto;
}

.custom-tabbar-no-create {
  grid-template-columns: 1fr 1fr 1fr 1fr;
}

.custom-tab-plus {
  transition: transform 220ms ease;
}

.custom-tab-plus-open {
  transform: rotate(135deg);
}

.create-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 54;
  opacity: 0;
  pointer-events: none;
  transition: opacity 240ms ease;
}

.create-menu-overlay-open {
  opacity: 1;
  pointer-events: auto;
}

.create-menu-backdrop {
  position: absolute;
  inset: 0;
  background: var(--neo-color-overlay);
  backdrop-filter: blur(12rpx);
}

.create-menu-actions {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(132rpx + env(safe-area-inset-bottom));
  height: 300rpx;
  pointer-events: none;
}

.create-menu-action {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18rpx;
  width: 180rpx;
  color: var(--neo-color-text-inverse);
  font-size: 25rpx;
  font-weight: 900;
  text-align: center;
  opacity: 0;
  transform: translateY(70rpx) scale(0.82);
  transition: opacity 260ms ease, transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}

.create-menu-overlay-open .create-menu-action {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.create-menu-action-left {
  left: 76rpx;
  bottom: 20rpx;
  transition-delay: 20ms;
}

.create-menu-action-center {
  left: 50%;
  bottom: 106rpx;
  transform: translateX(-50%) translateY(70rpx) scale(0.82);
  transition-delay: 70ms;
}

.create-menu-overlay-open .create-menu-action-center {
  transform: translateX(-50%) translateY(0) scale(1);
}

.create-menu-action-right {
  right: 76rpx;
  bottom: 20rpx;
  transition-delay: 120ms;
}

.create-menu-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 116rpx;
  height: 116rpx;
  border-radius: var(--neo-radius-round);
  background: var(--neo-color-overlay-panel);
  box-shadow: var(--neo-shadow-modal);
}

.create-menu-action-icon {
  position: relative;
  width: 54rpx;
  height: 54rpx;
}

.create-menu-icon-match {
  border: 6rpx solid var(--neo-color-accent);
  border-radius: 14rpx;
  box-sizing: border-box;
}

.create-menu-field-line {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 6rpx;
  margin-left: -3rpx;
  background: var(--neo-color-accent);
}

.create-menu-field-circle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 18rpx;
  height: 18rpx;
  margin-left: -9rpx;
  margin-top: -9rpx;
  border: 5rpx solid var(--neo-color-accent);
  border-radius: var(--neo-radius-round);
  box-sizing: border-box;
  background: var(--neo-color-overlay-panel);
}

.create-menu-icon-ball {
  border: 6rpx solid var(--neo-color-accent);
  border-radius: var(--neo-radius-round);
  box-sizing: border-box;
}

.create-menu-ball-panel {
  position: absolute;
  background: var(--neo-color-accent);
  border-radius: var(--neo-radius-round);
}

.create-menu-ball-panel-top {
  left: 50%;
  top: 10rpx;
  width: 16rpx;
  height: 16rpx;
  margin-left: -8rpx;
}

.create-menu-ball-panel-left {
  left: 9rpx;
  bottom: 10rpx;
  width: 18rpx;
  height: 8rpx;
  transform: rotate(35deg);
}

.create-menu-ball-panel-right {
  right: 9rpx;
  bottom: 10rpx;
  width: 18rpx;
  height: 8rpx;
  transform: rotate(-35deg);
}

.create-menu-icon-team {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 2rpx;
}

.create-menu-person {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.create-menu-person-main {
  transform: translateY(-4rpx);
}

.create-menu-person-head {
  width: 16rpx;
  height: 16rpx;
  border-radius: var(--neo-radius-round);
  background: var(--neo-color-accent);
}

.create-menu-person-body {
  width: 20rpx;
  height: 22rpx;
  margin-top: 3rpx;
  border-radius: 12rpx 12rpx 5rpx 5rpx;
  background: var(--neo-color-accent);
}

.create-menu-person-side .create-menu-person-head {
  width: 13rpx;
  height: 13rpx;
}

.create-menu-person-side .create-menu-person-body {
  width: 16rpx;
  height: 18rpx;
}

.create-menu-action-label {
  line-height: 1.25;
  text-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.45);
}

/* #ifdef H5 */
/* 宽屏 H5 下页面内容收敛为居中 750rpx 列，弹出菜单跟随该列而不是贴住窗口边缘。 */
.create-menu-actions {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */
</style>
