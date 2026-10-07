<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { AvatarItem } from './avatarTypes';
import { useOverlayPresence } from './useOverlayPresence';
import { prefersReducedMotion } from '@/utils/reducedMotion';
import AppButton from './AppButton.vue';

const props = defineProps<{ visible: boolean; avatar: AvatarItem | null; canShare?: boolean }>();
const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'presence', rendered: boolean): void;
  (event: 'share'): void;
}>();
const { rendered, leaving } = useOverlayPresence(computed(() => props.visible), {
  leaveDurationMs: () => prefersReducedMotion() ? 0 : 210,
});
watch(rendered, value => emit('presence', value), { immediate: true });
const imageFailed = ref(false);
const viewport = ref(uni.getWindowInfo());
function refreshViewport() { viewport.value = uni.getWindowInfo(); }
onMounted(() => uni.onWindowResize(refreshViewport));
onUnmounted(() => uni.offWindowResize(refreshViewport));
const imageSize = computed(() => {
  // 头像固定为正方形，用 aspectFill 撑满后在画面边缘裁切圆角。
  const maxWidth = Math.min(uni.upx2px(544), viewport.value.windowWidth - uni.upx2px(120)) - uni.upx2px(20);
  const maxHeight = Math.min(uni.upx2px(500), viewport.value.windowHeight * 0.52);
  const size = Math.max(1, Math.min(maxWidth, maxHeight));
  return { width: size, height: size };
});
const imageStyle = computed(() => ({ width: `${imageSize.value.width}px`, height: `${imageSize.value.height}px` }));
const portraitStyle = computed(() => ({
  width: `${imageSize.value.width + uni.upx2px(20)}px`,
  height: `${imageSize.value.height + uni.upx2px(20)}px`,
}));
watch(() => props.visible, visible => { if (visible) viewport.value = uni.getWindowInfo(); });
watch(() => [props.avatar?.id, props.avatar?.avatarUrl, props.visible], () => { if (props.visible) imageFailed.value = false; });
const name = computed(() => props.avatar?.name.trim() || '球友');
const attendanceCount = computed(() => {
  const count = props.avatar?.teamParticipationPoints;
  return typeof count === 'number' && Number.isFinite(count) && count >= 0 ? count : null;
});
const honors: Record<number, { title: string; tone: string }> = {
  1: { title: '年度活跃冠军', tone: 'gold' },
  2: { title: '年度活跃亚军', tone: 'silver' },
  3: { title: '年度活跃季军', tone: 'bronze' },
};
const attendanceHonor = computed(() => (attendanceCount.value ?? 0) > 0
  ? honors[props.avatar?.teamParticipationRank ?? 0] ?? null
  : null);
function close() {
  if (props.visible && !leaving.value) emit('close');
}
</script>

<template>
  <view v-if="rendered" class="avatar-preview-mask" :class="{ 'avatar-preview-mask--leaving': leaving }" @tap="close" @touchmove.stop.prevent @keydown.esc="close">
    <view class="avatar-preview-panel" role="dialog" aria-modal="true" :aria-label="`${name}的头像`" @tap.stop>
      <button class="avatar-preview-close" aria-label="关闭头像预览" hover-class="avatar-preview-close--pressed" :disabled="leaving" @tap.stop="close">×</button>
      <view class="avatar-preview-portrait" :class="{ 'avatar-preview-portrait--member': avatar?.isPaidMember }" :style="portraitStyle">
        <view class="avatar-preview-image-frame">
          <image v-if="avatar?.avatarUrl && !imageFailed" :key="avatar.avatarUrl" class="avatar-preview-image" :style="imageStyle" :src="avatar.avatarUrl" mode="aspectFill" :aria-label="`${name}的头像`" @error="imageFailed = true" />
          <view v-else class="avatar-preview-fallback">
            <text class="avatar-preview-initial">{{ name.slice(0, 1) }}</text>
            <text class="avatar-preview-empty">{{ imageFailed ? '头像暂时无法加载' : '暂无头像' }}</text>
          </view>
        </view>
      </view>
      <text class="avatar-preview-name">{{ name }}</text>
      <view v-if="attendanceHonor" class="avatar-preview-honor" :class="`avatar-preview-honor--${attendanceHonor.tone}`">
        <view class="avatar-preview-honor-icon" aria-hidden="true"><view class="avatar-preview-honor-cup" /><view class="avatar-preview-honor-stem" /></view>
        <text>{{ attendanceHonor.title }}</text>
      </view>
      <view v-if="attendanceCount != null" class="avatar-preview-attendance">
        <text>年度积分</text><text class="avatar-preview-attendance-number" :class="attendanceHonor ? `avatar-preview-attendance-number--${attendanceHonor.tone}` : ''">{{ attendanceCount }}</text><text>分</text>
      </view>
      <view v-if="canShare" class="avatar-preview-share"><AppButton block :disabled="leaving" @click="emit('share')">分享我的荣誉</AppButton></view>
    </view>
  </view>
</template>

<style scoped>
.avatar-preview-share { margin-top: 24rpx; }
.avatar-preview-mask { position: fixed; inset: 0; z-index: 150; padding: 32rpx; display: flex; align-items: center; justify-content: center; box-sizing: border-box; background: var(--ui-color-overlay); animation: avatar-preview-fade var(--ui-motion-overlay-duration) var(--ui-motion-ease-out) both; }
.avatar-preview-panel { position: relative; width: 600rpx; max-width: 100%; padding: 76rpx 28rpx 32rpx; box-sizing: border-box; border-radius: var(--ui-radius-card); background: var(--ui-color-surface); box-shadow: var(--ui-shadow-modal); animation: avatar-preview-enter var(--ui-motion-overlay-duration) var(--ui-motion-ease-out) both; }
.avatar-preview-close { position: absolute; top: 8rpx; right: 8rpx; display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; padding: 0; margin: 0; line-height: 1; font-size: 44rpx; color: var(--ui-color-text); background: transparent; border-radius: var(--ui-radius-round); }
.avatar-preview-close::after { border: 0; }
.avatar-preview-close--pressed { background: var(--ui-color-accent-soft); }
.avatar-preview-portrait { position: relative; margin: 0 auto; padding: 6rpx; border: 4rpx solid transparent; border-radius: var(--ui-radius-card); box-sizing: border-box; }
.avatar-preview-portrait--member { border-color: var(--ui-avatar-member-frame); }
.avatar-preview-image-frame { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; border-radius: var(--ui-radius-button); overflow: hidden; background: var(--ui-color-surface); }
.avatar-preview-image { display: block; flex-shrink: 0; border-radius: var(--ui-radius-button); overflow: hidden; }
.avatar-preview-fallback { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24rpx; color: var(--ui-color-text); }
.avatar-preview-initial { font-size: 120rpx; font-weight: var(--ui-font-weight-heading); }
.avatar-preview-empty { font-size: 24rpx; color: var(--ui-color-text-muted); }
.avatar-preview-name { display: block; margin-top: 24rpx; font-size: 34rpx; line-height: 1.5; text-align: center; font-weight: var(--ui-font-weight-heading); color: var(--ui-color-text); overflow-wrap: anywhere; max-height: 18vh; overflow-y: auto; }
.avatar-preview-honor { display: flex; align-items: center; justify-content: center; gap: 10rpx; width: fit-content; max-width: 100%; margin: 14rpx auto 0; padding: 10rpx 20rpx; border-radius: var(--ui-radius-round); font-size: 24rpx; line-height: 32rpx; font-weight: 600; }
.avatar-preview-honor--gold { color: var(--ui-avatar-attendance-gold); background: var(--ui-avatar-attendance-gold-bg); }
.avatar-preview-honor--silver { color: var(--ui-avatar-attendance-silver); background: var(--ui-avatar-attendance-silver-bg); }
.avatar-preview-honor--bronze { color: var(--ui-avatar-attendance-bronze); background: var(--ui-avatar-attendance-bronze-bg); }
/* 小型奖杯用原生 view 轮廓，颜色继承荣誉标签，兼容小程序与深色主题。 */
.avatar-preview-honor-icon { position: relative; width: 28rpx; height: 28rpx; flex-shrink: 0; border-bottom: 2rpx solid currentColor; box-sizing: border-box; }
.avatar-preview-honor-cup { position: absolute; left: 7rpx; top: 0; width: 14rpx; height: 18rpx; border: 2rpx solid currentColor; border-radius: 0 0 8rpx 8rpx; box-sizing: border-box; }
.avatar-preview-honor-icon::before, .avatar-preview-honor-icon::after { content: ''; position: absolute; top: 4rpx; width: 6rpx; height: 10rpx; border: 2rpx solid currentColor; box-sizing: border-box; }
.avatar-preview-honor-icon::before { left: 1rpx; border-right: 0; border-radius: 0 0 0 6rpx; }
.avatar-preview-honor-icon::after { right: 1rpx; border-left: 0; border-radius: 0 0 6rpx 0; }
.avatar-preview-honor-stem { position: absolute; left: 13rpx; top: 18rpx; width: 2rpx; height: 8rpx; background: currentColor; }
.avatar-preview-attendance { display: flex; align-items: baseline; justify-content: center; gap: 14rpx; margin-top: 22rpx; color: var(--ui-color-text-muted); font-size: 24rpx; line-height: 54rpx; }
.avatar-preview-attendance-number { color: var(--ui-color-text); font-size: 48rpx; font-weight: 600; line-height: 54rpx; font-variant-numeric: tabular-nums; }
.avatar-preview-attendance-number--gold { color: var(--ui-avatar-attendance-gold); }
.avatar-preview-attendance-number--silver { color: var(--ui-avatar-attendance-silver); }
.avatar-preview-attendance-number--bronze { color: var(--ui-avatar-attendance-bronze); }
.avatar-preview-mask--leaving { animation: avatar-preview-fade var(--ui-motion-overlay-duration) ease reverse both; }
.avatar-preview-mask--leaving .avatar-preview-panel { pointer-events: none; animation: avatar-preview-enter var(--ui-motion-overlay-duration) ease reverse both; }
@keyframes avatar-preview-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes avatar-preview-enter { from { opacity: 0; transform: translateY(10rpx) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
@media (prefers-reduced-motion: reduce) { .avatar-preview-mask, .avatar-preview-panel, .avatar-preview-mask--leaving .avatar-preview-panel { animation: none; } }
</style>
