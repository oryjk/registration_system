<script setup lang="ts">
import NeoSurface from "@/components/neo/NeoSurface.vue";
import type { TeamProfileViewModel } from "@/types/viewModels";

defineProps<{
  visible: boolean;
  teams: TeamProfileViewModel[];
  currentTeamId?: number;
  isSwitching: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "select", teamId: number): void;
}>();

function handleSelect(teamId: number, isCurrent: boolean) {
  if (isCurrent) {
    emit("close");
    return;
  }
  emit("select", teamId);
}
</script>

<template>
  <view v-if="visible" class="team-switch-mask" @tap="!isSwitching && emit('close')">
    <view class="team-switch-sheet" @tap.stop>
      <view class="team-switch-sheet__head">
        <view class="team-switch-sheet__texts">
          <text class="team-switch-sheet__title">切换当前球队</text>
          <text class="team-switch-sheet__caption">切换后，比赛和信用数据会同步更新</text>
        </view>
        <view class="team-switch-sheet__close" @tap="!isSwitching && emit('close')">×</view>
      </view>

      <scroll-view class="team-switch-sheet__list" scroll-y>
        <NeoSurface
          v-for="team in teams"
          :key="team.id"
          interactive
          flush
          @tap="handleSelect(team.id, team.id === currentTeamId)"
        >
          <view
            :class="[
              'team-switch-option',
              team.id === currentTeamId ? 'team-switch-option--current' : '',
              isSwitching ? 'team-switch-option--disabled' : '',
            ]"
          >
            <view class="team-switch-option__badge">{{ team.name.slice(0, 1) || "队" }}</view>
            <view class="team-switch-option__copy">
              <text class="team-switch-option__name">{{ team.name }}</text>
              <text class="team-switch-option__meta">{{ team.myRoleLabel }} · {{ team.memberCount }} 人</text>
            </view>
            <text v-if="team.id === currentTeamId" class="team-switch-option__mark">当前</text>
          </view>
        </NeoSurface>
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
  background: rgba(11, 14, 10, 0.34);
  animation: team-switch-mask-fade-in 220ms ease;
}

.team-switch-sheet {
  width: 100%;
  max-height: 70vh;
  padding: 34rpx 28rpx calc(env(safe-area-inset-bottom) + 28rpx);
  border: var(--neo-border-strong);
  border-bottom: none;
  border-radius: var(--neo-radius-md) var(--neo-radius-md) 0 0;
  background: var(--neo-surface-bg);
  box-shadow: var(--neo-surface-shadow);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  animation: team-switch-sheet-enter 240ms cubic-bezier(0.22, 1, 0.36, 1);
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
  color: var(--neo-color-text);
  font-size: 34rpx;
  line-height: 44rpx;
  font-weight: 900;
}

.team-switch-sheet__caption {
  display: block;
  margin-top: 8rpx;
  color: var(--neo-color-text-muted);
  font-size: 23rpx;
  line-height: 1.5;
  font-weight: 700;
}

.team-switch-sheet__close {
  width: 56rpx;
  height: 56rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-round);
  background: var(--neo-surface-bg);
  color: var(--neo-color-text-muted);
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

.team-switch-sheet__list :deep(.neo-surface) {
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
  background: var(--neo-color-info-soft);
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
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 26rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.team-switch-option__copy {
  min-width: 0;
  flex: 1;
}

.team-switch-option__name {
  display: block;
  color: var(--neo-color-text);
  font-size: 27rpx;
  font-weight: 900;
  line-height: 1.25;
  word-break: break-word;
}

.team-switch-option__meta {
  display: block;
  margin-top: 6rpx;
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.4;
}

.team-switch-option__mark {
  flex-shrink: 0;
  padding: 4rpx 12rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-round);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  font-size: 20rpx;
  font-weight: 900;
}

.team-switch-sheet__pending {
  flex-shrink: 0;
  display: block;
  margin-top: 14rpx;
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
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
</style>
