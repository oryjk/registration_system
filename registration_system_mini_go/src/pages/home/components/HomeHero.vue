<script setup lang="ts">
defineEmits<{
  (event: "open-team-hall"): void;
}>();
</script>

<template>
  <view class="hero">
    <image class="hero-image" src="/static/football-field.jpg" mode="aspectFill" />
    <view class="hero-overlay" />
    <view class="pitch-line pitch-line-one" />
    <view class="pitch-line pitch-line-two" />
    <view class="hero-content">
      <text class="hero-label">MATCH DAY</text>
      <text class="hero-title">约球开踢</text>
      <text class="hero-subtitle">组队 · 报名 · 上场</text>
      <button class="hero-action" @click="$emit('open-team-hall')">
        <text>进入约队大厅</text>
        <text class="action-arrow">→</text>
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.hero {
  position: relative;
  height: 270rpx;
  overflow: hidden;
  border-radius: 20rpx;
  background: var(--ink);
  color: #fff;
  box-shadow: 0 16rpx 36rpx rgba(19, 37, 26, 0.15);
}

.hero-image,
.hero-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.hero-image {
  opacity: 0.72;
}

.hero-overlay {
  background: linear-gradient(90deg, rgba(10, 27, 17, 0.98) 0%, rgba(10, 27, 17, 0.84) 51%, rgba(10, 27, 17, 0.18) 100%);
}

.pitch-line {
  position: absolute;
  right: -40rpx;
  width: 210rpx;
  height: 2rpx;
  background: rgba(184, 242, 41, 0.65);
  transform: rotate(-22deg);
}

.pitch-line-one {
  top: 62rpx;
}

.pitch-line-two {
  top: 92rpx;
  right: -62rpx;
}

.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  flex-direction: column;
  justify-content: center;
  padding: 24rpx 30rpx;
}

.hero-label {
  color: var(--accent);
  font-size: 19rpx;
  font-weight: 900;
}

.hero-title {
  margin-top: 5rpx;
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1.1;
}

.hero-subtitle {
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.74);
  font-size: 22rpx;
  font-weight: 650;
}

.hero-action {
  display: flex;
  width: 244rpx;
  min-height: 96rpx;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  margin: 20rpx 0 0;
  border-radius: 10rpx;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 22rpx;
  font-weight: 850;
  line-height: 96rpx;
  white-space: nowrap;
}

.hero-action text {
  line-height: 1;
  white-space: nowrap;
}

.action-arrow {
  font-size: 27rpx;
}
</style>
