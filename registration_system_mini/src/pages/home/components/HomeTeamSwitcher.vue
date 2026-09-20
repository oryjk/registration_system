<script setup lang="ts">
import { computed, ref } from "vue";
import { getCustomNavMetrics } from "@/utils/customNav";
import type { TeamProfileViewModel } from "@/types/viewModels";

const props = defineProps<{
  teams: TeamProfileViewModel[];
  currentTeamId?: number;
}>();

const emit = defineEmits<{
  (event: "switchTeam", teamId: number): void;
}>();

const navMetrics = getCustomNavMetrics();
const isOpen = ref(false);

const currentTeam = computed(() => props.teams.find((team) => team.id === props.currentTeamId) ?? props.teams[0]);

// 遮罩与面板从 header 底缘（headerTop + 胶囊高 + 底 padding 14rpx）之下开始，不遮顶部入口。
const headerBottomPx = navMetrics.headerTop + navMetrics.headerMinHeight + 7;
const overlayStyle = { top: `${headerBottomPx}px` };
const panelStyle = { top: `${headerBottomPx + 6}px` };

function toggle() {
  // 单队无切换对象：入口只作身份展示，不弹面板。
  if (props.teams.length < 2) return;
  isOpen.value = !isOpen.value;
}

function close() {
  isOpen.value = false;
}

function handleSelect(team: TeamProfileViewModel) {
  if (team.id === props.currentTeamId) {
    close();
    return;
  }
  close();
  emit("switchTeam", team.id);
}
</script>

<template>
  <view v-if="currentTeam" class="home-team-switch">
    <view :class="['home-team-entry', isOpen ? 'home-team-entry--open' : '']" @tap.stop="toggle">
      <view class="home-team-entry__logo">
        <image v-if="currentTeam.logoUrl" class="home-team-entry__logo-image" :src="currentTeam.logoUrl" mode="aspectFill" />
        <text v-else class="home-team-entry__initial">{{ currentTeam.name.slice(0, 1) || "队" }}</text>
      </view>
      <text class="home-team-entry__name">{{ currentTeam.name }}</text>
      <text v-if="teams.length >= 2" class="home-team-entry__caret">{{ isOpen ? "▴" : "▾" }}</text>
    </view>

    <view v-if="isOpen" class="home-team-overlay" :style="overlayStyle" @tap="close" />
    <view v-if="isOpen" class="home-team-panel" :style="panelStyle" @tap.stop>
      <view class="home-team-panel__head">
        <view class="home-team-panel__texts">
          <text class="home-team-panel__title">切换当前球队</text>
          <text class="home-team-panel__caption">比赛与信用数据随身份更新</text>
        </view>
        <view class="home-team-panel__close" @tap="close">×</view>
      </view>

      <scroll-view class="home-team-panel__list" scroll-y>
        <view
          v-for="team in teams"
          :key="team.id"
          :class="['home-team-option', team.id === currentTeamId ? 'home-team-option--current' : '']"
          @tap="handleSelect(team)"
        >
          <view class="home-team-option__logo">
            <image v-if="team.logoUrl" class="home-team-option__logo-image" :src="team.logoUrl" mode="aspectFill" />
            <text v-else class="home-team-option__initial">{{ team.name.slice(0, 1) || "队" }}</text>
          </view>
          <view class="home-team-option__copy">
            <text class="home-team-option__name">{{ team.name }}</text>
            <text class="home-team-option__meta">{{ team.myRoleLabel }} · {{ team.memberCount }} 人</text>
          </view>
          <text v-if="team.id === currentTeamId" class="home-team-option__now">当前</text>
          <text v-else class="home-team-option__go">›</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style scoped>
.home-team-entry {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-height: 64rpx;
  padding: 0 8rpx 0 4rpx;
}

.home-team-entry__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 52rpx;
  height: 52rpx;
  overflow: hidden;
  border: var(--neo-border-default);
  border-radius: 12rpx;
  background: var(--neo-color-surface);
  box-shadow: 3rpx 3rpx 0 var(--neo-color-text);
  box-sizing: border-box;
}

.home-team-entry__logo-image {
  width: 100%;
  height: 100%;
}

.home-team-entry__initial {
  color: var(--neo-color-text);
  font-size: 26rpx;
  font-weight: 900;
}

.home-team-entry__name {
  max-width: 340rpx;
  overflow: hidden;
  color: var(--neo-color-text);
  font-size: 34rpx;
  font-weight: 800;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.home-team-entry--open .home-team-entry__name {
  color: var(--neo-color-accent-deep);
}

.home-team-entry__caret {
  margin-top: 2rpx;
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 900;
  line-height: 1;
}

.home-team-overlay {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  background: var(--neo-color-overlay);
  animation: home-team-overlay-fade 220ms ease;
}

.home-team-panel {
  position: fixed;
  left: 28rpx;
  z-index: 61;
  display: flex;
  flex-direction: column;
  width: 588rpx;
  max-height: 60vh;
  padding: 8rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  background: var(--neo-surface-bg);
  box-shadow: var(--neo-shadow-raised);
  box-sizing: border-box;
  animation: home-team-panel-in 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.home-team-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  padding: 16rpx 18rpx 20rpx;
  border-bottom: var(--neo-border-default);
  flex-shrink: 0;
}

.home-team-panel__texts {
  min-width: 0;
}

.home-team-panel__title {
  display: block;
  color: var(--neo-color-text);
  font-size: 27rpx;
  font-weight: 900;
}

.home-team-panel__caption {
  display: block;
  margin-top: 6rpx;
  color: var(--neo-color-text-muted);
  font-size: 20rpx;
  font-weight: 700;
  line-height: 1.4;
}

.home-team-panel__close {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 48rpx;
  height: 48rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-round);
  background: var(--neo-surface-bg);
  color: var(--neo-color-text-muted);
  font-size: 30rpx;
  line-height: 1;
  box-sizing: border-box;
}

.home-team-panel__list {
  flex: 1;
  min-height: 0;
  max-height: 46vh;
  margin-top: 8rpx;
}

.home-team-option {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 100rpx;
  padding: 14rpx 16rpx;
  border-radius: var(--neo-radius-sm);
  box-sizing: border-box;
}

.home-team-option--current {
  background: var(--neo-color-info-soft);
}

.home-team-option__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 60rpx;
  height: 60rpx;
  overflow: hidden;
  border: var(--neo-border-default);
  border-radius: 12rpx;
  background: var(--neo-color-surface);
  box-sizing: border-box;
}

.home-team-option__logo-image {
  width: 100%;
  height: 100%;
}

.home-team-option__initial {
  color: var(--neo-color-text);
  font-size: 27rpx;
  font-weight: 900;
}

.home-team-option__copy {
  min-width: 0;
  flex: 1;
}

.home-team-option__name {
  display: block;
  overflow: hidden;
  color: var(--neo-color-text);
  font-size: 27rpx;
  font-weight: 900;
  line-height: 1.25;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.home-team-option__meta {
  display: block;
  margin-top: 6rpx;
  color: var(--neo-color-text-muted);
  font-size: 21rpx;
  font-weight: 700;
  line-height: 1.4;
}

.home-team-option__now {
  flex-shrink: 0;
  padding: 5rpx 13rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  font-size: 20rpx;
  font-weight: 900;
}

.home-team-option__go {
  flex-shrink: 0;
  color: var(--neo-color-text-muted);
  font-size: 32rpx;
  font-weight: 900;
  line-height: 1;
}

@keyframes home-team-overlay-fade {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes home-team-panel-in {
  from {
    opacity: 0;
    transform: translateY(-12rpx) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
