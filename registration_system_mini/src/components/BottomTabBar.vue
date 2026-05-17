<script setup lang="ts">
import { ref } from "vue";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { useTeamContext } from "@/stores/teamContext";
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
const isOpen = ref(false);

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
  uni.navigateTo({
    url: "/pages/teams/manage/index",
  });
}

function handleCreateIndividualChallenge() {
  closeSheet();
  uni.navigateTo({
    url: "/pages/challenges/create-individual/index?kind=individual",
  });
}
</script>

<template>
  <view class="custom-tabbar-shell">
    <view class="custom-tabbar">
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
    </view>

    <view :class="['create-menu-overlay', isOpen ? 'create-menu-overlay-open' : '']" @tap="closeSheet">
      <view class="create-menu-backdrop" />
      <view class="create-menu-actions" @tap.stop>
        <view class="create-menu-action create-menu-action-left" @tap="handleCreateMatch">
          <view class="create-menu-action-button">
            <text class="create-menu-action-icon">赛</text>
          </view>
          <text class="create-menu-action-label">创建比赛</text>
        </view>

        <view class="create-menu-action create-menu-action-center" @tap="handleCreateIndividualChallenge">
          <view class="create-menu-action-button">
            <text class="create-menu-action-icon">约</text>
          </view>
          <text class="create-menu-action-label">创建散人约球</text>
        </view>

        <view class="create-menu-action create-menu-action-right" @tap="handleCreateTeam">
          <view class="create-menu-action-button">
            <text class="create-menu-action-icon">队</text>
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
  background: rgba(17, 24, 39, 0.42);
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
  color: #ffffff;
  font-size: 25rpx;
  font-weight: 900;
  text-align: center;
  opacity: 0;
  transform: translateY(70rpx) scale(0.82);
  transition: opacity 260ms ease, transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: auto;
}

.create-menu-overlay-open .create-menu-action {
  opacity: 1;
  transform: translateY(0) scale(1);
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
  border-radius: 999rpx;
  background: rgba(82, 83, 82, 0.96);
  box-shadow: 0 16rpx 38rpx rgba(0, 0, 0, 0.26);
}

.create-menu-action-icon {
  color: #c8ff00;
  font-size: 38rpx;
  font-weight: 900;
}

.create-menu-action-label {
  line-height: 1.25;
  text-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.45);
}
</style>
