<script setup lang="ts">
import TeamRoleIcon from "@/components/ui/TeamRoleIcon.vue";
import { computed } from "vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import { useOverlayPresence } from "@/components/ui/useOverlayPresence";
import { prefersReducedMotion } from "@/utils/reducedMotion";
import type { TeamProfileViewModel } from "@/types/viewModels";

const props = defineProps<{
  visible: boolean;
  teams: TeamProfileViewModel[];
  currentTeamId?: number;
  isSwitching: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "select", teamId: number): void;
}>();

// 底部弹层退场时序：淡出下滑期间遮罩继续拦截点击（防点穿），结束才卸载。
const { rendered, leaving } = useOverlayPresence(
  computed(() => props.visible),
  { leaveDurationMs: () => prefersReducedMotion() ? 0 : 210 },
);

function handleClose() {
  if (!rendered.value || leaving.value || props.isSwitching) return;
  emit("close");
}

function handleSelect(teamId: number, isCurrent: boolean) {
  if (!props.visible || !rendered.value || leaving.value || props.isSwitching) return;
  if (isCurrent) {
    emit("close");
    return;
  }
  emit("select", teamId);
}
</script>

<template>
  <view v-if="rendered" :class="['team-switch-mask', leaving ? 'team-switch-mask--leaving' : '']" @tap="handleClose">
    <view class="team-switch-sheet" @tap.stop>
      <view class="team-switch-sheet__head">
        <view class="team-switch-sheet__texts">
          <text class="team-switch-sheet__title">切换当前球队</text>
          <text class="team-switch-sheet__caption">切换后，比赛和信用数据会同步更新</text>
        </view>
        <view class="team-switch-sheet__close" @tap="handleClose">×</view>
      </view>

      <scroll-view class="team-switch-sheet__list" scroll-y>
        <AppSurface
          v-for="team in teams"
          :key="team.id"
          interactive
          flush
          @press="handleSelect(team.id, team.id === currentTeamId)"
          :disabled="isSwitching || leaving"
        >
          <view
            :class="[
              'team-switch-option',
              team.id === currentTeamId ? 'team-switch-option--current' : '',
              isSwitching ? 'team-switch-option--disabled' : '',
            ]"
          >
            <view class="team-switch-option__badge">
              <image v-if="team.logoUrl" class="team-switch-option__logo" :src="team.logoUrl" mode="aspectFit" />
              <text v-else>{{ team.name.slice(0, 1) || "队" }}</text>
            </view>
            <view class="team-switch-option__copy">
              <text class="team-switch-option__name">{{ team.name }}</text>
              <view class="team-switch-option__meta"><TeamRoleIcon :team-role="team.myRole" :label="team.myRoleLabel" /><text>{{ team.memberCount }} 人</text></view>
            </view>
            <text v-if="team.id === currentTeamId" class="team-switch-option__mark">当前</text>
          </view>
        </AppSurface>
      </scroll-view>

      <text v-if="isSwitching" class="team-switch-sheet__pending">球队数据切换中...</text>
    </view>
  </view>
</template>

<style scoped>
.team-switch-mask {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: flex-end;
  background: var(--ui-color-overlay);
  animation: team-switch-mask-fade-in var(--ui-motion-overlay-duration) ease;
}

/* 退场：遮罩淡出期间仍覆盖屏幕拦截点击（防点穿），面板下滑收起且不再接受交互。 */
.team-switch-mask--leaving {
  animation: team-switch-mask-fade-out var(--ui-motion-overlay-duration) ease forwards;
}

.team-switch-mask--leaving .team-switch-sheet {
  pointer-events: none;
  animation: team-switch-sheet-exit var(--ui-motion-overlay-duration) var(--ui-motion-ease-out) forwards;
}

.team-switch-sheet {
  width: 100%;
  max-height: 70vh;
  padding: 34rpx 28rpx calc(env(safe-area-inset-bottom) + 28rpx);
  border: var(--ui-border-default);
  border-bottom: none;
  border-radius: var(--ui-radius-md) var(--ui-radius-md) 0 0;
  background: var(--ui-surface-bg);
  box-shadow: var(--ui-surface-shadow);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  animation: team-switch-sheet-enter var(--ui-motion-overlay-duration) var(--ui-motion-ease-out);
}

.team-switch-sheet__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  flex-shrink: 0;
}

.team-switch-sheet__texts {
  min-width: 0;
}

.team-switch-sheet__title {
  display: block;
  color: var(--ui-color-text);
  font-size: 34rpx;
  line-height: 44rpx;
  font-weight: 600;
}

.team-switch-sheet__caption {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-color-text-muted);
  font-size: 23rpx;
  line-height: 1.5;
  font-weight: 400;
}

.team-switch-sheet__close {
  width: 56rpx;
  height: 56rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-round);
  background: var(--ui-surface-bg);
  color: var(--ui-color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  line-height: 1;
  flex-shrink: 0;
  box-sizing: border-box;
}

.team-switch-sheet__list {
  flex: 1;
  min-height: 0;
  margin-top: 22rpx;
  max-height: 46vh;
}

.team-switch-sheet__list :deep(.ui-surface) {
  display: block;
  margin-bottom: 14rpx;
}

.team-switch-option {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 102rpx;
  padding: 16rpx;
  box-sizing: border-box;
}

.team-switch-option--current {
  background: var(--ui-color-info-soft);
}

.team-switch-option--disabled {
  opacity: 0.46;
}

.team-switch-option__badge {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 62rpx;
  height: 62rpx;
  overflow: hidden;
  border: none;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 600;
  box-sizing: border-box;
}

.team-switch-option__logo {
  width: 100%;
  height: 100%;
}

.team-switch-option__copy {
  min-width: 0;
  flex: 1;
}

.team-switch-option__name {
  display: block;
  color: var(--ui-color-text);
  font-size: 27rpx;
  font-weight: 600;
  line-height: 1.25;
  word-break: break-word;
}

.team-switch-option__meta { display: flex; align-items: center; gap: 8rpx;
  margin-top: 6rpx;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  font-weight: 400;
  line-height: 1.4;
}

.team-switch-option__mark {
  flex-shrink: 0;
  padding: 4rpx 12rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-accent);
  color: var(--ui-color-text);
  font-size: 20rpx;
  font-weight: 600;
}

.team-switch-sheet__pending {
  flex-shrink: 0;
  display: block;
  margin-top: 14rpx;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  font-weight: 400;
}

@keyframes team-switch-mask-fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes team-switch-sheet-enter {
  from {
    transform: translateY(100%);
  }

  to {
    transform: translateY(0);
  }
}

@keyframes team-switch-mask-fade-out {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

@keyframes team-switch-sheet-exit {
  from {
    transform: translateY(0);
  }

  to {
    transform: translateY(100%);
  }
}

/* H5 减少动态效果：弹层直接出现/消失。 */
@media (prefers-reduced-motion: reduce) {
  .team-switch-mask,
  .team-switch-mask--leaving,
  .team-switch-sheet,
  .team-switch-mask--leaving .team-switch-sheet {
    animation: none;
  }
}
</style>
