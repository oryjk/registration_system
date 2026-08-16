<script lang="ts">
import { ref } from "vue";
import { listTestLoginUsers } from "@/api/auth";
import type { TestLoginUser } from "@/types/app";

// 面板嵌在 AppTabHeader 中，每个页面都会新建实例；
// 用户列表与选中项提升到模块级共享，避免每次切页都重复请求 /test-auth/users。
const sharedUsers = ref<TestLoginUser[]>([]);
const sharedSelectedUserId = ref<number | null>(null);
let sharedLoadPromise: Promise<void> | null = null;

async function loadSharedUsers() {
  if (sharedUsers.value.length > 0) return;
  if (!sharedLoadPromise) {
    sharedLoadPromise = listTestLoginUsers()
      .then((result) => {
        sharedUsers.value = result.items;
        sharedSelectedUserId.value = result.items.some((user) => user.id === result.default_user_id)
          ? result.default_user_id
          : (result.items[0]?.id ?? null);
      })
      .finally(() => {
        sharedLoadPromise = null;
      });
  }
  await sharedLoadPromise;
}
</script>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import { loginWithTestUser, useAppSession } from "@/stores/appSession";

const { currentUser, isBootstrapping } = useAppSession();
const users = sharedUsers;
const selectedUserId = sharedSelectedUserId;
const errorMessage = ref("");
const isLoading = ref(false);

const enabled = computed(() => import.meta.env.MODE !== "production" && import.meta.env.VITE_ENABLE_H5_TEST_LOGIN === "true");
const shouldShow = computed(() => enabled.value && !currentUser.value);
const selectedUser = computed(() => users.value.find((user) => user.id === selectedUserId.value) ?? null);

async function loadUsers() {
  // 已登录时面板不可见，无需再拉取测试用户列表
  if (!enabled.value || currentUser.value || users.value.length > 0 || isLoading.value) return;
  isLoading.value = true;
  errorMessage.value = "";
  try {
    await loadSharedUsers();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "测试用户列表加载失败";
  } finally {
    isLoading.value = false;
  }
}

function handleUserChange(event: { detail?: { value?: string | number } }) {
  const index = Number(event.detail?.value ?? -1);
  selectedUserId.value = users.value[index]?.id ?? null;
}

async function handleLogin() {
  if (!selectedUserId.value || isBootstrapping.value) return;
  errorMessage.value = "";
  try {
    await loginWithTestUser(selectedUserId.value);
    uni.$emit("session:login-completed", { fromRoute: "h5-test-login" });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "测试用户登录失败";
  }
}

onMounted(() => {
  void loadUsers();
});
</script>

<template>
  <NeoSurface v-if="shouldShow" variant="dark" custom-class="h5-test-login-panel">
    <view class="h5-test-login-panel__eyebrow">H5 DEV LOGIN</view>
    <text class="h5-test-login-panel__title">选择测试用户</text>
    <text class="h5-test-login-panel__copy">使用后端测试登录接口签发真实 JWT。</text>

    <view v-if="isLoading" class="h5-test-login-panel__state">加载用户列表...</view>
    <view v-else-if="errorMessage" class="h5-test-login-panel__state h5-test-login-panel__state--error">
      {{ errorMessage }}
    </view>
    <template v-else>
      <picker
        mode="selector"
        :range="users.map((user) => user.display_name)"
        :value="Math.max(users.findIndex((user) => user.id === selectedUserId), 0)"
        @change="handleUserChange"
      >
        <view class="h5-test-login-panel__picker">
          <text>{{ selectedUser?.display_name || "选择用户" }}</text>
          <text class="h5-test-login-panel__picker-arrow">⌄</text>
        </view>
      </picker>
      <NeoButton block :loading="isBootstrapping" :disabled="!selectedUserId" @click="handleLogin">
        {{ isBootstrapping ? "登录中..." : "使用测试用户登录" }}
      </NeoButton>
    </template>
  </NeoSurface>
</template>

<style scoped>
.h5-test-login-panel {
  position: fixed;
  left: 28rpx;
  right: 28rpx;
  bottom: calc(env(safe-area-inset-bottom) + 126rpx);
  z-index: 90;
  padding: 24rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-text);
  color: var(--neo-color-text-inverse);
  box-shadow: 8rpx 8rpx 0 var(--neo-color-accent);
}

.h5-test-login-panel__eyebrow {
  color: var(--neo-color-accent);
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
}

.h5-test-login-panel__title {
  display: block;
  margin-top: 8rpx;
  font-size: 30rpx;
  font-weight: 900;
}

.h5-test-login-panel__copy,
.h5-test-login-panel__state {
  display: block;
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.7);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.45;
}

.h5-test-login-panel__state--error {
  color: #ff9d8d;
}

.h5-test-login-panel__picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 76rpx;
  margin: 18rpx 0;
  padding: 0 18rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
}

.h5-test-login-panel__picker-arrow {
  font-size: 30rpx;
}
</style>
