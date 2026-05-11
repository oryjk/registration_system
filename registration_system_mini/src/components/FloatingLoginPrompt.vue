<script setup lang="ts">
import { computed, ref } from "vue";
import { resumeSessionBootstrap, useAppSession } from "@/stores/appSession";
import { hasManualLogout } from "@/utils/authStorage";

const { currentUser, bootstrapError, refreshSessionContext } = useAppSession();
const isNavigatingToLogin = ref(false);

const shouldShow = computed(() => {
  if (currentUser.value || isNavigatingToLogin.value) {
    return false;
  }

  return hasManualLogout() || bootstrapError.value.includes("已退出登录");
});

function getCurrentPageRoute() {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  return currentPage?.route ? `/${currentPage.route}` : "";
}

async function goToLogin() {
  if (isNavigatingToLogin.value) {
    return;
  }

  isNavigatingToLogin.value = true;
  const fromRoute = getCurrentPageRoute();
  resumeSessionBootstrap();
  uni.showLoading({
    title: "登录中...",
    mask: true,
  });

  try {
    await refreshSessionContext();
    uni.$emit("session:login-completed", { fromRoute });
  } catch (error) {
    isNavigatingToLogin.value = false;
    uni.showToast({
      title: error instanceof Error ? error.message : "登录失败",
      icon: "none",
    });
  } finally {
    uni.hideLoading();
  }
}
</script>

<template>
  <view v-if="shouldShow" class="floating-login-prompt">
    <view class="floating-login-copy">
      <text class="floating-login-title">请先登录</text>
      <text class="floating-login-text">登录后查看你的比赛、出勤和球队数据。</text>
    </view>
    <view class="floating-login-button" @tap="goToLogin">去登录</view>
  </view>
</template>

<style scoped>
.floating-login-prompt {
  position: fixed;
  left: 28rpx;
  right: 28rpx;
  bottom: calc(env(safe-area-inset-bottom) + 126rpx);
  z-index: 85;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22rpx;
  padding: 22rpx 24rpx 22rpx 28rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 24rpx 52rpx rgba(18, 19, 16, 0.12);
  backdrop-filter: blur(18rpx);
  -webkit-backdrop-filter: blur(18rpx);
  box-sizing: border-box;
}

.floating-login-copy {
  min-width: 0;
  flex: 1;
}

.floating-login-title {
  display: block;
  color: #111310;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1.2;
}

.floating-login-text {
  display: block;
  margin-top: 6rpx;
  color: #6b7068;
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.35;
}

.floating-login-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 148rpx;
  height: 68rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #111310;
  font-size: 28rpx;
  font-weight: 900;
  flex-shrink: 0;
}
</style>
