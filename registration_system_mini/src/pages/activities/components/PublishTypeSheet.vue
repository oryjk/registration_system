<script setup lang="ts">
defineProps<{
  visible: boolean;
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
      <view class="publish-menu-action publish-menu-action-left" @tap="handlePublishTeam">
        <view class="publish-menu-action-button">
          <text class="publish-menu-action-icon">队</text>
        </view>
        <text class="publish-menu-action-label">球队约队</text>
      </view>

      <view class="publish-menu-action publish-menu-action-right" @tap="handlePublishIndividual">
        <view class="publish-menu-action-button publish-menu-action-button-light">
          <text class="publish-menu-action-icon">人</text>
        </view>
        <text class="publish-menu-action-label">散人约队</text>
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
  background: rgba(17, 24, 39, 0.42);
  backdrop-filter: blur(12rpx);
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
  color: #ffffff;
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

.publish-menu-action-button,
.publish-menu-close {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  box-shadow: 0 16rpx 38rpx rgba(0, 0, 0, 0.26);
}

.publish-menu-action-button {
  width: 116rpx;
  height: 116rpx;
  background: rgba(82, 83, 82, 0.96);
}

.publish-menu-action-button-light {
  background: rgba(64, 66, 62, 0.96);
}

.publish-menu-action-icon {
  color: #c8ff00;
  font-size: 38rpx;
  font-weight: 900;
}

.publish-menu-action-label {
  line-height: 1.25;
  text-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.45);
}

.publish-menu-close {
  position: absolute;
  left: 50%;
  bottom: -18rpx;
  width: 96rpx;
  height: 96rpx;
  margin-left: -48rpx;
  background: #c8ff00;
  color: #111111;
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
</style>
