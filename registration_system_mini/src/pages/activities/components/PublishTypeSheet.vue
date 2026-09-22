<script setup lang="ts">
import { computed } from "vue";
import { useOverlayPresence } from "@/components/ui/useOverlayPresence";
import { prefersReducedMotion } from "@/utils/reducedMotion";

const props = defineProps<{
  visible: boolean;
  /** 散人（无可管理球队/场馆身份）不能以球队名义发布，按钮置灰但可点击触发引导。 */
  teamPublishDisabled?: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "publishTeam"): void;
  (event: "publishIndividual"): void;
}>();

// 与确认弹窗/底栏创建菜单同一退场时序：淡出期间遮罩继续拦截点击，防点穿。
// 退场时长在关闭时刻实时读取"减少动态效果"，设置切换后立即生效。
const { rendered, leaving } = useOverlayPresence(
  computed(() => props.visible),
  { leaveDurationMs: () => prefersReducedMotion() ? 0 : 210 },
);

function handleClose() {
  if (!rendered.value || leaving.value) return;
  emit("close");
}

function handlePublishTeam() {
  // 事件入口检查可见状态：面板不可见/退场中一律不触发发布跳转，杜绝透明热区误触。
  if (!rendered.value || leaving.value) return;
  emit("publishTeam");
}

function handlePublishIndividual() {
  if (!rendered.value || leaving.value) return;
  emit("publishIndividual");
}
</script>

<template>
  <view
    :class="[
      'publish-menu-overlay',
      rendered && !leaving ? 'publish-menu-overlay-open' : '',
      leaving ? 'publish-menu-overlay-closing' : '',
    ]"
    @tap="handleClose"
  >
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
  transition: opacity var(--ui-motion-overlay-duration) ease;
}

.publish-menu-overlay-open {
  opacity: 1;
  pointer-events: auto;
}

/* 淡出期间保持点击拦截，退场结束才放行页面（防点穿）。 */
.publish-menu-overlay-closing {
  opacity: 0;
  pointer-events: auto;
}

.publish-menu-backdrop {
  position: absolute;
  inset: 0;
  background: var(--ui-color-overlay);
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
  color: var(--ui-color-text-inverse);
  font-size: 25rpx;
  font-weight: 600;
  text-align: center;
  opacity: 0;
  transform: translateY(70rpx) scale(0.82);
  transition: opacity var(--ui-motion-overlay-duration) ease, transform var(--ui-motion-overlay-duration) var(--ui-motion-ease-out);
  /* 关闭/退场态彻底禁点：子元素显式 none，不依赖遮罩层的 pointer-events 继承。 */
  pointer-events: none;
}

.publish-menu-overlay-open .publish-menu-action {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
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

/* 与 BottomTabBar 创建菜单按钮保持一致：主题色圆形按钮 + 柔和阴影。 */
.publish-menu-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 116rpx;
  height: 116rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-accent);
  box-shadow: var(--ui-shadow-card);
}

.publish-menu-action-icon {
  color: var(--ui-color-text);
  font-size: 38rpx;
  font-weight: 600;
}

.publish-menu-action-label {
  line-height: 1.25;
  text-shadow: 0 4rpx 12rpx rgba(17, 19, 16, 0.45);
}

.publish-menu-close {
  position: absolute;
  left: 50%;
  bottom: -18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96rpx;
  height: 96rpx;
  margin-left: -48rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-accent);
  color: var(--ui-color-text);
  box-shadow: var(--ui-shadow-card);
  opacity: 0;
  transform: translateY(72rpx) rotate(-90deg) scale(0.84);
  transition: opacity var(--ui-motion-overlay-duration) ease, transform var(--ui-motion-overlay-duration) var(--ui-motion-ease-out);
  transition-delay: 130ms;
  pointer-events: none;
}

.publish-menu-overlay-open .publish-menu-close {
  opacity: 1;
  transform: translateY(0) rotate(0deg) scale(1);
  pointer-events: auto;
}

.publish-menu-close-symbol {
  font-size: 46rpx;
  font-weight: 600;
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

/* H5 减少动态效果：菜单直接切换（JS 侧同步跳过移除延迟）。 */
@media (prefers-reduced-motion: reduce) {
  .publish-menu-overlay,
  .publish-menu-action,
  .publish-menu-close {
    transition: none;
  }
}
</style>
