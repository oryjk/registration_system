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
  isOpen.value = true;
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

      <view class="custom-tab-item custom-tab-item-active">
        <view class="custom-tab-plus" @tap="openSheet">
          <text class="custom-tab-plus-symbol">+</text>
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

    <view v-if="isOpen" class="fab-overlay" @tap="closeSheet">
      <view class="fab-sheet" @tap.stop>
        <view class="fab-sheet-handle" />
        <view class="fab-sheet-title">快捷创建</view>
        <view class="fab-sheet-caption">创建比赛或球队后，会自动刷新你的当前球队上下文。</view>

        <view class="fab-option-grid">
          <view class="fab-option-card fab-option-card-dark" @tap="handleCreateMatch">
            <view class="fab-option-icon">赛</view>
            <view class="fab-option-title">创建比赛</view>
            <view class="fab-option-text">
              {{ currentTeam ? `当前球队：${currentTeam.name}` : "请先完成登录并加入球队" }}
            </view>
          </view>

          <view class="fab-option-card" @tap="handleCreateTeam">
            <view class="fab-option-icon fab-option-icon-light">队</view>
            <view class="fab-option-title">创建球队</view>
            <view class="fab-option-text">创建新球队，也可以搜索已有球队申请加入。</view>
          </view>
        </view>

        <view class="fab-sheet-close" @tap="closeSheet">×</view>
      </view>
    </view>
  </view>
</template>
