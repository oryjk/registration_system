<script setup lang="ts">
import TeamRoleIcon from "@/components/ui/TeamRoleIcon.vue";
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useOverlayPresence } from "@/components/ui/useOverlayPresence";
import { prefersReducedMotion } from "@/utils/reducedMotion";
import { getCustomNavMetrics } from "@/utils/customNav";
import type { TeamProfileViewModel } from "@/types/viewModels";

const props = defineProps<{
  teams: TeamProfileViewModel[];
  currentTeamId?: number;
  /** 外部交互（如 header 搜索展开）需要强制收起下拉面板时置 true；置回 false 不会自动重新打开。 */
  forceClosed?: boolean;
}>();

const emit = defineEmits<{
  (event: "switchTeam", teamId: number): void;
}>();

const navMetrics = getCustomNavMetrics();
const isOpen = ref(false);
const { rendered, leaving } = useOverlayPresence(isOpen, {
  leaveDurationMs: () => prefersReducedMotion() ? 0 : 210,
});

const currentTeam = computed(() => props.teams.find((team) => team.id === props.currentTeamId) ?? props.teams[0]);

// 下拉面板紧贴入口底边，实际位置和宽度在打开前测量。
const headerBottomPx = navMetrics.headerTop + navMetrics.headerMinHeight + 7;
const overlayStyle = { top: `${headerBottomPx}px` };
const entryWidth = ref(0);
const entryBottom = ref(headerBottomPx);
const panelStyle = computed(() => ({
  top: `${entryBottom.value}px`,
  width: `${entryWidth.value}px`,
}));
const instance = getCurrentInstance();
let disposed = false;
let openRequest = 0;

async function measureEntry() {
  await nextTick();
  if (disposed) return;
  // 测量未缩放的外层，避免按压动画把下拉宽度缩小。
  await new Promise<void>(resolve => {
    uni.createSelectorQuery().in(instance?.proxy).select(".home-team-switch")
      .boundingClientRect(rect => {
        const box = Array.isArray(rect) ? rect[0] : rect;
        if (!disposed && box?.width) {
          entryWidth.value = box.width;
          if (typeof box.bottom === "number") entryBottom.value = box.bottom;
        }
        resolve();
      }).exec();
  });
}
onMounted(() => { uni.onWindowResize(measureEntry); });
onUnmounted(() => { disposed = true; openRequest++; uni.offWindowResize(measureEntry); });

watch(() => props.forceClosed, (forceClosed) => {
  if (forceClosed) close();
});

async function toggle() {
  // 单队无切换对象：入口只作身份展示，不弹面板。
  if (props.teams.length < 2 || props.forceClosed) return;
  if (isOpen.value) { close(); return; }
  const request = ++openRequest;
  await measureEntry();
  if (!disposed && request === openRequest && !props.forceClosed && entryWidth.value > 0) {
    isOpen.value = true;
  }
}

function close() {
  openRequest++;
  isOpen.value = false;
}

function handleSelect(team: TeamProfileViewModel) {
  if (!isOpen.value || leaving.value) return;
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
    <view :class="['home-team-entry', rendered ? 'home-team-entry--open' : '']"
      :hover-class="teams.length >= 2 && !rendered ? 'home-team-entry--pressed' : 'none'"
      :role="teams.length >= 2 ? 'button' : undefined"
      :aria-expanded="isOpen" :aria-label="teams.length >= 2 ? '切换球队，当前' + currentTeam.name : currentTeam.name"
      @tap.stop="toggle">
      <view class="home-team-entry__logo">
        <image v-if="currentTeam.logoUrl" class="home-team-entry__logo-image" :src="currentTeam.logoUrl" mode="aspectFill" />
        <text v-else class="home-team-entry__initial">{{ currentTeam.name.slice(0, 1) || "队" }}</text>
      </view>
      <text class="home-team-entry__name">{{ currentTeam.name }}</text>
      <view v-if="teams.length >= 2" class="home-team-entry__caret" :class="{ 'home-team-entry__caret--open': isOpen }" />
    </view>

    <view v-if="rendered" class="home-team-overlay" :class="{ 'home-team-overlay--leaving': leaving }" :style="overlayStyle" @tap="close" />
    <!-- 关闭时保留节点完成退场动画；退出期间拒绝重复选队。 -->
    <view v-if="rendered" class="home-team-panel" :class="{ 'home-team-panel--leaving': leaving }" :style="panelStyle" @tap.stop>
      <scroll-view class="home-team-panel__list" scroll-y>
        <view
          v-for="team in teams"
          :key="team.id"
          :class="['home-team-option', team.id === currentTeamId ? 'home-team-option--current' : '']"
          role="button"
          :aria-label="team.id === currentTeamId ? team.name + '，当前球队，点击收起' : '切换到' + team.name"
          hover-class="home-team-option--pressed"
          @tap="handleSelect(team)"
        >
          <view class="home-team-option__logo">
            <image v-if="team.logoUrl" class="home-team-option__logo-image" :src="team.logoUrl" mode="aspectFill" />
            <text v-else class="home-team-option__initial">{{ team.name.slice(0, 1) || "队" }}</text>
          </view>
          <view class="home-team-option__copy">
            <text class="home-team-option__name">{{ team.name }}</text>
            <view class="home-team-option__meta">
              <TeamRoleIcon :team-role="team.myRole" :label="team.myRoleLabel" />
              <text class="home-team-option__count">{{ team.memberCount }} 人</text>
            </view>
          </view>
          <view v-if="team.id === currentTeamId" class="home-team-option__now" aria-hidden="true">
            <wd-icon name="check" size="28rpx" color="var(--ui-color-accent-deep)" />
          </view>
          <view v-else class="home-team-option__action">
            <wd-icon name="arrow-right" size="28rpx" color="var(--ui-color-accent-deep)" />
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style scoped>
.home-team-switch { min-width: 0; max-width: 100%; }

.home-team-entry {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-height: 64rpx;
  padding: 0 14rpx 0 6rpx;
  min-width: 0;
  border-radius: 18rpx;
  transition: background-color var(--ui-motion-press-duration) ease, transform var(--ui-motion-press-duration) ease;
}

.home-team-entry__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44rpx;
  height: 44rpx;
  overflow: hidden;
  border: 0;
  border-radius: 14rpx;
  background: var(--ui-color-surface);
  box-sizing: border-box;
}

.home-team-entry__logo-image {
  width: 100%;
  height: 100%;
}

.home-team-entry__initial {
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 600;
}

.home-team-entry__name {
  max-width: 300rpx;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.home-team-entry--open .home-team-entry__name {
  color: var(--ui-color-accent-deep);
}

.home-team-entry--pressed { background: var(--ui-color-neutral-bg); transform: scale(0.98); }
.home-team-entry--open { background: var(--ui-color-surface); border-radius: 18rpx 18rpx 0 0; }
.home-team-entry__caret {
  width: 10rpx;
  height: 10rpx;
  margin: -5rpx 4rpx 0 8rpx;
  flex-shrink: 0;
  border-right: 2rpx solid var(--ui-color-text-muted);
  border-bottom: 2rpx solid var(--ui-color-text-muted);
  transform: rotate(45deg);
  transition: transform var(--ui-motion-overlay-duration) var(--ui-motion-ease-out);
}
.home-team-entry__caret--open { transform: translateY(5rpx) rotate(225deg); }

.home-team-overlay {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  background: var(--ui-color-overlay);
  animation: home-team-overlay-fade var(--ui-motion-overlay-duration) ease both;
}

.home-team-panel {
  position: fixed;
  left: 28rpx;
  z-index: 61;
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0 0 18rpx 18rpx;
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-soft);
  box-sizing: border-box;
  transform-origin: top left;
  animation: home-team-panel-in var(--ui-motion-overlay-duration) var(--ui-motion-ease-out) both;
}

.home-team-panel__list {
  flex: 1;
  min-height: 0;
  max-height: 46vh;
  border-top: 1rpx solid var(--ui-color-line);

}

.home-team-option {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-height: 72rpx;
  background: transparent;
  transition: background-color var(--ui-motion-press-duration) ease;
  padding: 12rpx 14rpx;
  border-radius: 0;
  box-sizing: border-box;
}

.home-team-option--current {
  background: var(--ui-color-accent-soft);
}

.home-team-option--current .home-team-option__name {
  color: var(--ui-color-accent-deep);
}

.home-team-option__action,
.home-team-option__now {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32rpx;
  height: 40rpx;
}

.home-team-option__action {
  transition: transform var(--ui-motion-press-duration) ease;
}

.home-team-option__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44rpx;
  height: 44rpx;
  overflow: hidden;
  border: 0;
  border-radius: 14rpx;
  background: var(--ui-color-surface);
  box-sizing: border-box;
}

.home-team-option__logo-image {
  width: 100%;
  height: 100%;
}

.home-team-option__initial {
  color: var(--ui-color-text);
  font-size: 27rpx;
  font-weight: 600;
}

.home-team-option__copy {
  display: flex;
  align-items: center;
  gap: 8rpx;
  min-width: 0;
  flex: 1;
}

.home-team-option__name {
  display: block;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-color-text);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.home-team-option__meta {
  display: flex;
  align-items: center;
  gap: 6rpx;
  flex-shrink: 0;
  white-space: nowrap;
  color: var(--ui-color-text-muted);
  font-size: 20rpx;
  font-weight: 500;
  line-height: 1.4;
}

/* meta 整体右贴，人数位数不同（8 人 / 12 人）会把角色图标顶得左右错开；
   固定右对齐占位后角色图标列保持同一竖直线，超过三位数时优雅退化。 */
.home-team-option__count {
  min-width: 60rpx;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.home-team-option--pressed { background: var(--ui-color-neutral-bg); }
.home-team-option--pressed .home-team-option__action { transform: scale(0.9); }
.home-team-overlay--leaving { animation: home-team-overlay-fade var(--ui-motion-overlay-duration) ease reverse both; }
.home-team-panel--leaving { pointer-events: none; animation: home-team-panel-in var(--ui-motion-overlay-duration) ease reverse both; }

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
    transform: translateY(-8rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .home-team-entry, .home-team-entry__caret { transition: none; }
  .home-team-entry--pressed, .home-team-option--pressed .home-team-option__action { transform: none; }
  .home-team-overlay, .home-team-panel { animation: none; }
}
</style>
