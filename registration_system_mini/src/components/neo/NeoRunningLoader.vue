<script setup lang="ts">
withDefaults(defineProps<{
  /** 加载文案，展示在动画下方 */
  text?: string;
}>(), {
  text: "正在进入球场",
});
</script>

<template>
  <view class="neo-runner">
    <view class="neo-runner__scene" aria-hidden="true">
      <image
        class="neo-runner__sprite"
        src="/static/illustrations/dribbling-sprite.png"
        mode="scaleToFill"
      />
    </view>
    <view class="neo-runner__caption">
      <text class="neo-runner__text">{{ text }}</text>
      <view class="neo-runner__dots" aria-hidden="true">
        <view class="neo-runner__dot" />
        <view class="neo-runner__dot" />
        <view class="neo-runner__dot" />
      </view>
    </view>
  </view>
</template>

<style scoped>
.neo-runner {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 0 40rpx;
}

.neo-runner__scene {
  position: relative;
  width: 480rpx;
  height: 360rpx;
  overflow: hidden;
}

/* 4×4 透明精灵图：关节、触球、地面共用同一帧，避免肢体和足球各自漂移。
   插画颜色属于 decorative asset；再生成脚本位于 scripts/assets。
   每帧 320×240，2 倍导出后整张为 2560×1920，避免超宽纹理。 */
.neo-runner__sprite {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920rpx;
  height: 1440rpx;
  max-width: none;
  animation: runner-dribble 0.72s steps(1, end) infinite;
}

.neo-runner__caption {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  margin-top: 18rpx;
}

.neo-runner__text {
  font-size: 25rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
  color: var(--neo-color-text-muted);
}

.neo-runner__dots {
  display: flex;
  gap: 7rpx;
}

.neo-runner__dot {
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: var(--neo-color-text-muted);
  opacity: 0.25;
  animation: runner-dot 0.72s ease-in-out infinite;
}

.neo-runner__dot:nth-child(2) { animation-delay: 0.12s; }
.neo-runner__dot:nth-child(3) { animation-delay: 0.24s; }

@keyframes runner-dribble {
  0%, 100% { transform: translate(0, 0); }
  6.25% { transform: translate(-25%, 0); }
  12.5% { transform: translate(-50%, 0); }
  18.75% { transform: translate(-75%, 0); }
  25% { transform: translate(0, -25%); }
  31.25% { transform: translate(-25%, -25%); }
  37.5% { transform: translate(-50%, -25%); }
  43.75% { transform: translate(-75%, -25%); }
  50% { transform: translate(0, -50%); }
  56.25% { transform: translate(-25%, -50%); }
  62.5% { transform: translate(-50%, -50%); }
  68.75% { transform: translate(-75%, -50%); }
  75% { transform: translate(0, -75%); }
  81.25% { transform: translate(-25%, -75%); }
  87.5% { transform: translate(-50%, -75%); }
  93.75% { transform: translate(-75%, -75%); }
}

@keyframes runner-dot {
  0%, 70%, 100% { opacity: 0.25; }
  35% { opacity: 0.8; }
}

@media (prefers-reduced-motion: reduce) {
  .neo-runner__sprite,
  .neo-runner__dot {
    animation: none;
  }
}
</style>
