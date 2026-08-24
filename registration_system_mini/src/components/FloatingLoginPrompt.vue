<script setup lang="ts">
import { computed, ref, watch } from "vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import { resumeSessionBootstrap, useAppSession } from "@/stores/appSession";
import { hasManualLogout } from "@/utils/authStorage";

const { currentUser, bootstrapError, refreshSessionContext } = useAppSession();
const isNavigatingToLogin = ref(false);

// 登出标记在点击登录瞬间就会被 resumeSessionBootstrap 清除，而 storage 读取非响应式；
// 用本地 armed 状态锁定"曾处于登出态"，登录未成功前保持入口可见，失败后可重试。
const isPromptArmed = ref(false);
const logoutState = computed(() => hasManualLogout() || bootstrapError.value.includes("已退出登录"));
watch(logoutState, (value) => {
  if (value) isPromptArmed.value = true;
}, { immediate: true });

const shouldShow = computed(() => !currentUser.value && !isNavigatingToLogin.value && isPromptArmed.value);

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
    // H5 无微信登录通道时 ensureSessionReady 会静默返回：不能伪装成登录成功，
    // 保留入口并明确告知，且不发登录完成事件（页面不会误刷新）。
    if (!currentUser.value) {
      uni.showToast({
        title: "当前环境暂不支持微信登录，请在微信小程序中操作",
        icon: "none",
        duration: 3000,
      });
      return;
    }
    uni.$emit("session:login-completed", { fromRoute });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "登录失败，请重试",
      icon: "none",
      duration: 3000,
    });
  } finally {
    uni.hideLoading();
    isNavigatingToLogin.value = false;
  }
}
</script>

<template>
  <view v-if="shouldShow" class="floating-login-prompt">
    <!-- 卡片皮肤直接用本组件节点实现（token 与 NeoSurface raised 同值）：
         custom-class 无法穿透小程序组件样式隔离，fixed 定位与 flex 布局会全部失效。 -->
    <view class="floating-login-prompt__card">
      <view class="floating-login-prompt__copy">
        <text class="floating-login-prompt__title">请先登录</text>
        <text class="floating-login-prompt__text">登录后查看你的比赛、出勤和球队数据。</text>
      </view>
      <NeoButton variant="lime" size="sm" @click="goToLogin">去登录</NeoButton>
    </view>
  </view>
</template>

<style scoped>
.floating-login-prompt {
  position: fixed;
  left: 28rpx;
  right: 28rpx;
  bottom: calc(env(safe-area-inset-bottom) + 126rpx);
  z-index: 85;
}

.floating-login-prompt__card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22rpx;
  padding: 22rpx 24rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
}

.floating-login-prompt__copy {
  min-width: 0;
  flex: 1;
}

.floating-login-prompt__title {
  display: block;
  color: var(--neo-color-text);
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1.2;
}

.floating-login-prompt__text {
  display: block;
  margin-top: 6rpx;
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.35;
}
</style>
