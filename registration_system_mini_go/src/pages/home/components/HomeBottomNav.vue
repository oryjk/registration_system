<script setup lang="ts">
type HomeNavAction = "home" | "team" | "create" | "stats" | "profile";

defineEmits<{
  (event: "activate", action: HomeNavAction): void;
}>();
</script>

<template>
  <view class="nav-shell">
    <view class="bottom-nav" aria-label="主要导航">
      <button class="nav-item active" @click="$emit('activate', 'home')">
        <view class="nav-icon home-icon" aria-hidden="true"><view /></view>
        <text>首页</text>
      </button>
      <button class="nav-item" @click="$emit('activate', 'team')">
        <view class="nav-icon team-nav-icon" aria-hidden="true"><view /></view>
        <text>约队</text>
      </button>
      <button class="nav-item create-item" @click="$emit('activate', 'create')">
        <view class="create-button" aria-hidden="true">+</view>
        <text>创建</text>
      </button>
      <button class="nav-item" @click="$emit('activate', 'stats')">
        <view class="nav-icon stats-icon" aria-hidden="true">
          <view /><view /><view />
        </view>
        <text>统计</text>
      </button>
      <button class="nav-item" @click="$emit('activate', 'profile')">
        <view class="nav-icon profile-icon" aria-hidden="true"><view /></view>
        <text>我的</text>
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.nav-shell {
  position: fixed;
  z-index: 50;
  right: 0;
  bottom: 0;
  left: 0;
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 2rpx solid rgba(19, 37, 26, 0.08);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 -14rpx 36rpx rgba(19, 37, 26, 0.07);
}

.bottom-nav {
  display: grid;
  width: 100%;
  max-width: 840rpx;
  min-height: 124rpx;
  grid-template-columns: repeat(5, 1fr);
  align-items: end;
  margin: 0 auto;
  padding: 8rpx 12rpx 10rpx;
}

.nav-item {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 104rpx;
  align-items: center;
  justify-content: flex-end;
  flex-direction: column;
  gap: 5rpx;
  padding: 4rpx;
  background: transparent;
  color: #89908b;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.2;
}

.nav-item.active {
  color: var(--ink);
  font-weight: 900;
}

.nav-icon {
  position: relative;
  width: 42rpx;
  height: 42rpx;
  color: currentColor;
}

.home-icon::before {
  position: absolute;
  top: 6rpx;
  left: 7rpx;
  width: 25rpx;
  height: 25rpx;
  border: 5rpx solid currentColor;
  border-right: 0;
  border-bottom: 0;
  content: "";
  transform: rotate(45deg);
}

.home-icon view {
  position: absolute;
  right: 8rpx;
  bottom: 3rpx;
  left: 8rpx;
  height: 25rpx;
  border: 5rpx solid currentColor;
  border-top: 0;
  border-radius: 3rpx;
}

.team-nav-icon::before,
.team-nav-icon::after {
  position: absolute;
  top: 4rpx;
  width: 15rpx;
  height: 15rpx;
  border: 4rpx solid currentColor;
  border-radius: 50%;
  content: "";
}

.team-nav-icon::before {
  left: 1rpx;
}

.team-nav-icon::after {
  right: 1rpx;
}

.team-nav-icon view {
  position: absolute;
  right: 1rpx;
  bottom: 3rpx;
  left: 1rpx;
  height: 15rpx;
  border: 4rpx solid currentColor;
  border-radius: 18rpx 18rpx 4rpx 4rpx;
}

.create-item {
  color: var(--ink);
}

.create-button {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  margin-top: -24rpx;
  border: 6rpx solid #fff;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 9rpx 18rpx rgba(73, 102, 8, 0.2);
  color: var(--accent-ink);
  font-size: 48rpx;
  font-weight: 500;
  line-height: 1;
}

.stats-icon {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4rpx;
  padding: 5rpx 4rpx;
  border-bottom: 4rpx solid currentColor;
}

.stats-icon view {
  width: 7rpx;
  border-radius: 3rpx 3rpx 0 0;
  background: currentColor;
}

.stats-icon view:nth-child(1) { height: 15rpx; }
.stats-icon view:nth-child(2) { height: 29rpx; }
.stats-icon view:nth-child(3) { height: 22rpx; }

.profile-icon::before {
  position: absolute;
  top: 2rpx;
  left: 12rpx;
  width: 15rpx;
  height: 15rpx;
  border: 4rpx solid currentColor;
  border-radius: 50%;
  content: "";
}

.profile-icon view {
  position: absolute;
  right: 5rpx;
  bottom: 2rpx;
  left: 5rpx;
  height: 18rpx;
  border: 4rpx solid currentColor;
  border-radius: 20rpx 20rpx 4rpx 4rpx;
}

@media (min-width: 768px) {
  .nav-shell {
    right: 50%;
    left: auto;
    width: 420px;
    transform: translateX(50%);
  }
}
</style>
