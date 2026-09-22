<script setup lang="ts">
import { computed } from "vue";
import ExpandableAvatarStack from "./ExpandableAvatarStack.vue";
import type { AvatarItem } from "./avatarTypes";
import { registrationProgressState } from "./registrationProgressState";

const props = defineProps<{
  joined: number;
  title?: string;
  subtitle?: string;
  minimum?: number | null;
  maximum?: number | null;
  /** 未传入表示没有头像数据；空数组表示暂无报名球员。人数不从头像数量推导。 */
  avatars?: AvatarItem[];
  disabled?: boolean;
}>();
const emit = defineEmits<{ (event: "avatarSelect", id: string | number): void }>();
const state = computed(() => registrationProgressState(props.joined, props.minimum, props.maximum));
</script>

<template>
  <view class="registration-summary">
    <view class="registration-head">
      <text class="registration-title">{{ title || '报名进度' }}</text>
      <text class="registration-count">已报名 <text class="registration-count-number">{{ joined }}</text> 人</text>
    </view>
    <text v-if="subtitle" class="registration-subtitle">{{ subtitle }}</text>
    <view v-if="avatars" class="registration-crowd" @touchstart.stop @touchend.stop @touchcancel.stop>
      <ExpandableAvatarStack v-if="avatars.length" :items="avatars" size="sm" :disabled="disabled" @select="emit('avatarSelect', $event)" />
      <text v-else class="registration-meta">暂无报名球员</text>
    </view>
    <view class="registration-progress">
      <view v-if="state.progressPercent !== null" class="registration-track">
        <view class="registration-fill" :class="{ 'registration-fill--pending': state.belowMinimum }" :style="{ width: `${state.basePercent}%` }" />
        <view v-if="state.extraPercent > 0" class="registration-extra" :style="{ left: `${state.basePercent}%`, width: `${state.extraPercent}%` }" />
        <view v-if="state.minimumPercent !== null" class="registration-minimum" :style="{ left: `${state.minimumPercent}%` }" />
      </view>
      <!-- 保留成行分隔点与分段颜色，刻度只标右端容量。 -->
      <view class="registration-scale">
        <text class="registration-scale-end">{{ state.minimum && state.minimum === state.maximum ? `${state.minimum} 人成行 · 满员` : state.maximum ? `最多 ${state.maximum} 人` : '人数不限' }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.registration-summary { --ui-avatar-border: 0; min-width: 0; color: var(--now-color-text); }
.registration-meta { color: var(--now-color-muted); font-size: 24rpx; line-height: 1.6; }
.registration-crowd { display: flex; align-items: center; }
.registration-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16rpx; margin-bottom: 10rpx; }
.registration-title { min-width: 0; font-size: 26rpx; line-height: 1.5; font-weight: 600; overflow-wrap: anywhere; }
.registration-count { flex-shrink: 0; white-space: nowrap; font-size: 24rpx; line-height: 1.5; }
.registration-subtitle { display: block; margin-bottom: 10rpx; color: var(--now-color-muted); font-size: 22rpx; line-height: 1.4; }
.registration-count-number { font-weight: 600; font-variant-numeric: tabular-nums; }
.registration-track { position: relative; height: 10rpx; background: var(--now-color-line); border-radius: 8rpx; margin-top: 12rpx; overflow: hidden; }
.registration-fill, .registration-extra { position: absolute; top: 0; height: 100%; transition: width var(--ui-motion-progress-duration) ease, left var(--ui-motion-progress-duration) ease, background-color var(--ui-motion-progress-duration) ease; }
.registration-fill { left: 0; background: var(--now-progress-ready); }
.registration-fill--pending { background: var(--now-progress-pending); }
.registration-extra { background: var(--now-progress-extra); }
.registration-minimum { position: absolute; top: 0; width: 3rpx; height: 100%; background: var(--now-color-surface); transform: translateX(-50%); }
.registration-scale { position: relative; height: 28rpx; margin-top: 6rpx; color: var(--now-color-muted); font-size: 22rpx; line-height: 30rpx; }
.registration-scale-end { position: absolute; right: 0; top: 0; white-space: nowrap; }

@media (prefers-reduced-motion: reduce) {
  .registration-fill, .registration-extra { transition: none; }
}
</style>
