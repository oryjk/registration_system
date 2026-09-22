<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { AvatarItem } from './avatarTypes';
import { useOverlayPresence } from './useOverlayPresence';
import { prefersReducedMotion } from '@/utils/reducedMotion';

const props = defineProps<{ visible: boolean; avatar: AvatarItem | null }>();
const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'presence', rendered: boolean): void;
}>();
const { rendered, leaving } = useOverlayPresence(computed(() => props.visible), {
  leaveDurationMs: () => prefersReducedMotion() ? 0 : 210,
});
watch(rendered, value => emit('presence', value), { immediate: true });
const imageFailed = ref(false);
const imageRatio = ref(1);
const viewport = ref(uni.getWindowInfo());
function refreshViewport() { viewport.value = uni.getWindowInfo(); }
onMounted(() => uni.onWindowResize(refreshViewport));
onUnmounted(() => uni.offWindowResize(refreshViewport));
const imageStyle = computed(() => {
  // 图片元素与实际画面等大，圆角才能裁到画面边缘，而非 aspectFit 的留白。
  const maxWidth = Math.min(uni.upx2px(544), viewport.value.windowWidth - uni.upx2px(120));
  const maxHeight = Math.min(uni.upx2px(500), viewport.value.windowHeight * 0.52);
  const width = Math.max(1, Math.min(maxWidth, maxHeight * imageRatio.value));
  return { width: `${width}px`, height: `${width / imageRatio.value}px` };
});
watch(() => [props.avatar?.id, props.avatar?.avatarUrl], () => { imageRatio.value = 1; });
watch(() => props.visible, visible => { if (visible) viewport.value = uni.getWindowInfo(); });
function onImageLoad(event: Event) {
  const { width = 0, height = 0 } = (event as Event & { detail?: { width?: number; height?: number } }).detail ?? {};
  if (width > 0 && height > 0) imageRatio.value = width / height;
}
watch(() => [props.avatar?.id, props.avatar?.avatarUrl, props.visible], () => { if (props.visible) imageFailed.value = false; });
const name = computed(() => props.avatar?.name.trim() || '球友');
function close() {
  if (props.visible && !leaving.value) emit('close');
}
</script>

<template>
  <view v-if="rendered" class="avatar-preview-mask" :class="{ 'avatar-preview-mask--leaving': leaving }" @tap="close" @touchmove.stop.prevent @keydown.esc="close">
    <view class="avatar-preview-panel" role="dialog" aria-modal="true" :aria-label="`${name}的头像`" @tap.stop>
      <button class="avatar-preview-close" aria-label="关闭头像预览" hover-class="avatar-preview-close--pressed" :disabled="leaving" @tap.stop="close">×</button>
      <view class="avatar-preview-image-frame">
        <image v-if="avatar?.avatarUrl && !imageFailed" :key="avatar.avatarUrl" class="avatar-preview-image" :style="imageStyle" @load="onImageLoad" :src="avatar.avatarUrl" mode="aspectFit" :aria-label="`${name}的头像`" @error="imageFailed = true" />
        <view v-else class="avatar-preview-fallback">
          <text class="avatar-preview-initial">{{ name.slice(0, 1) }}</text>
          <text class="avatar-preview-empty">{{ imageFailed ? '头像暂时无法加载' : '暂无头像' }}</text>
        </view>
      </view>
      <text class="avatar-preview-name">{{ name }}</text>
    </view>
  </view>
</template>

<style scoped>
.avatar-preview-mask { position: fixed; inset: 0; z-index: 150; padding: 32rpx; display: flex; align-items: center; justify-content: center; box-sizing: border-box; background: var(--ui-color-overlay); animation: avatar-preview-fade var(--ui-motion-overlay-duration) var(--ui-motion-ease-out) both; }
.avatar-preview-panel { position: relative; width: 600rpx; max-width: 100%; padding: 76rpx 28rpx 32rpx; box-sizing: border-box; border-radius: var(--ui-radius-card); background: var(--ui-color-surface); box-shadow: var(--ui-shadow-modal); animation: avatar-preview-enter var(--ui-motion-overlay-duration) var(--ui-motion-ease-out) both; }
.avatar-preview-close { position: absolute; top: 8rpx; right: 8rpx; display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; padding: 0; margin: 0; line-height: 1; font-size: 44rpx; color: var(--ui-color-text); background: transparent; border-radius: var(--ui-radius-round); }
.avatar-preview-close::after { border: 0; }
.avatar-preview-close--pressed { background: var(--ui-color-accent-soft); }
.avatar-preview-image-frame { display: flex; align-items: center; justify-content: center; height: 500rpx; max-height: 52vh; border-radius: var(--ui-radius-button); overflow: hidden; background: var(--ui-color-surface); }
.avatar-preview-image { display: block; flex-shrink: 0; border-radius: var(--ui-radius-card); overflow: hidden; }
.avatar-preview-fallback { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24rpx; color: var(--ui-color-text); }
.avatar-preview-initial { font-size: 120rpx; font-weight: var(--ui-font-weight-heading); }
.avatar-preview-empty { font-size: 24rpx; color: var(--ui-color-text-muted); }
.avatar-preview-name { display: block; margin-top: 24rpx; font-size: 34rpx; line-height: 1.5; text-align: center; font-weight: var(--ui-font-weight-heading); color: var(--ui-color-text); overflow-wrap: anywhere; max-height: 18vh; overflow-y: auto; }
.avatar-preview-mask--leaving { animation: avatar-preview-fade var(--ui-motion-overlay-duration) ease reverse both; }
.avatar-preview-mask--leaving .avatar-preview-panel { pointer-events: none; animation: avatar-preview-enter var(--ui-motion-overlay-duration) ease reverse both; }
@keyframes avatar-preview-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes avatar-preview-enter { from { opacity: 0; transform: translateY(10rpx) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
@media (prefers-reduced-motion: reduce) { .avatar-preview-mask, .avatar-preview-panel, .avatar-preview-mask--leaving .avatar-preview-panel { animation: none; } }
</style>
