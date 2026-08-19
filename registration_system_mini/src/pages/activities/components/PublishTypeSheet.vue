<script setup lang="ts">
defineProps<{
  visible: boolean;
  /** 散人（无可管理球队/场馆身份）不能以球队名义发布，按钮置灰但可点击触发引导。 */
  teamPublishDisabled?: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "publishTeam"): void;
  (event: "publishIndividual"): void;
}>();

function handleClose() {
  emit("close");
}

function handlePublishTeam() {
  emit("publishTeam");
}

function handlePublishIndividual() {
  emit("publishIndividual");
}
</script>

<template>
  <view :class="['publish-menu-overlay', visible ? 'publish-menu-overlay-open' : '']" @tap="handleClose">
    <view class="publish-menu-backdrop" />
    <view class="publish-menu-actions" @tap.stop>
      <view
        :class="['publish-menu-action', 'publish-menu-action-left', teamPublishDisabled ? 'publish-menu-action-disabled' : '']"
        @tap="handlePublishTeam"
      >
        <view class="publish-menu-action-button">
          <text class="publish-menu-action-icon">队</text>
        </view>
        <text class="publish-menu-action-label">球队约队</text>
      </view>

      <view class="publish-menu-action publish-menu-action-right" @tap="handlePublishIndividual">
        <view class="publish-menu-action-button">
          <text class="publish-menu-action-icon">人</text>
        </view>
        <text class="publish-menu-action-label">散人约球</text>
      </view>

      <view class="publish-menu-close" @tap="handleClose">
        <text class="publish-menu-close-symbol">×</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.publish-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  opacity: 0;
  pointer-events: none;
  transition: opacity 240ms ease;
}

.publish-menu-overlay-open {
  opacity: 1;
  pointer-events: auto;
}

.publish-menu-backdrop {
  position: absolute;
  inset: 0;
  background: var(--neo-color-overlay);
}

.publish-menu-actions {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(132rpx + env(safe-area-inset-bottom));
  height: 300rpx;
  pointer-events: none;
}

.publish-menu-action {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18rpx;
  width: 190rpx;
  color: var(--neo-color-text-inverse);
  font-size: 25rpx;
  font-weight: 900;
  text-align: center;
  opacity: 0;
  transform: translateY(70rpx) scale(0.82);
  transition: opacity 260ms ease, transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: auto;
}

.publish-menu-overlay-open .publish-menu-action {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.publish-menu-action-left {
  left: 128rpx;
  bottom: 76rpx;
  transition-delay: 30ms;
}

.publish-menu-action-right {
  right: 128rpx;
  bottom: 76rpx;
  transition-delay: 90ms;
}

/* 禁用态保持可点击（点击由页面弹窗引导），只做视觉降级。 */
.publish-menu-action-disabled {
  opacity: 0.45;
  filter: grayscale(1);
}

.publish-menu-close {
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
}

/* 与 BottomTabBar 创建菜单按钮保持一致：青柠色块 + 墨色描边 + 硬偏移阴影。 */
.publish-menu-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 116rpx;
  height: 116rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-accent);
  box-shadow: 4rpx 4rpx 0 var(--neo-color-text);
}

.publish-menu-action-icon {
  color: var(--neo-color-text);
  font-size: 38rpx;
  font-weight: 900;
}

.publish-menu-action-label {
  line-height: 1.25;
  text-shadow: 0 4rpx 12rpx rgba(17, 19, 16, 0.45);
}

.publish-menu-close {
  position: absolute;
  left: 50%;
  bottom: -18rpx;
  width: 96rpx;
  height: 96rpx;
  margin-left: -48rpx;
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  box-shadow: 4rpx 4rpx 0 var(--neo-color-text);
  opacity: 0;
  transform: translateY(72rpx) rotate(-90deg) scale(0.84);
  transition: opacity 260ms ease, transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: 130ms;
  pointer-events: auto;
}

.publish-menu-overlay-open .publish-menu-close {
  opacity: 1;
  transform: translateY(0) rotate(0deg) scale(1);
}

.publish-menu-close-symbol {
  font-size: 46rpx;
  font-weight: 900;
  line-height: 1;
}

/* #ifdef H5 */
/* 宽屏 H5 下页面内容收敛为居中 750rpx 列，发布菜单跟随该列而不是贴住窗口边缘。 */
.publish-menu-actions {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */
</style>
