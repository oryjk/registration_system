<template>
  <div class="relative flex min-h-screen w-full overflow-hidden">
    <!-- 左侧品牌区 -->
    <div
      class="hidden lg:flex w-1/2 relative flex-col items-center justify-center bg-primary overflow-hidden"
    >
      <div class="absolute inset-0 z-0">
        <div class="absolute inset-0 bg-primary/80 z-10 mix-blend-multiply"></div>
        <div
          class="h-full w-full bg-cover bg-center opacity-40 mix-blend-overlay"
          style="
            background-image: url('https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1920&q=80');
          "
        ></div>
      </div>
      <div class="relative z-20 flex flex-col gap-8 max-w-[560px] px-12 text-white">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-4">
            <div
              class="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 border border-white/30 shadow-xl"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-8 w-8"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
                />
              </svg>
            </div>
            <h1 class="text-4xl font-black leading-tight tracking-tight">球队管理后台</h1>
          </div>
          <p class="text-lg opacity-90 max-w-md leading-relaxed">
            统一管理球队、活动报名与账单，让俱乐部运营更高效。
          </p>
        </div>
        <div class="flex flex-wrap gap-3 mt-4">
          <div
            class="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-lg border border-white/15"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
              />
            </svg>
            <span class="text-sm font-medium">球队管理</span>
          </div>
          <div
            class="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-lg border border-white/15"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"
              />
            </svg>
            <span class="text-sm font-medium">活动报名</span>
          </div>
          <div
            class="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-lg border border-white/15"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"
              />
            </svg>
            <span class="text-sm font-medium">账单管理</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧登录表单 -->
    <div class="flex w-full lg:w-1/2 flex-col justify-center items-center p-6 lg:p-24 bg-base-100">
      <!-- 移动端品牌头 -->
      <div class="lg:hidden w-full max-w-[440px] mb-8 flex items-center gap-3 text-primary">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-content"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
            />
          </svg>
        </div>
        <span class="text-xl font-bold">球队管理后台</span>
      </div>

      <div class="w-full max-w-[440px] flex flex-col gap-8">
        <!-- 表单标题 -->
        <div class="flex flex-col gap-1.5">
          <p class="text-3xl font-bold tracking-tight">欢迎回来</p>
          <p class="text-sm text-base-content/60">请输入您的管理员账号和密码</p>
        </div>

        <!-- 错误提示 -->
        <div v-if="error" role="alert" class="alert alert-error py-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span class="text-sm">{{ error }}</span>
        </div>

        <!-- 登录表单 -->
        <form @submit.prevent="handleLogin" class="flex flex-col gap-5">
          <!-- 用户名 -->
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">用户名</span>
            <div class="relative group">
              <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 text-base-content/40 group-focus-within:text-primary transition-colors"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                  />
                </svg>
              </div>
              <input
                v-model="form.username"
                type="text"
                placeholder="请输入用户名"
                class="input input-bordered border-2 w-full h-12 pl-10 pr-4 text-base"
                autocomplete="username"
                required
              />
            </div>
          </label>

          <!-- 密码 -->
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">密码</span>
            <div class="relative group">
              <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 text-base-content/40 group-focus-within:text-primary transition-colors"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"
                  />
                </svg>
              </div>
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                class="input input-bordered border-2 w-full h-12 pl-10 pr-12 text-base"
                autocomplete="current-password"
                required
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-base-content/40 hover:text-base-content/70 transition-colors"
                @click="showPassword = !showPassword"
              >
                <svg
                  v-if="showPassword"
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
                  />
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"
                  />
                </svg>
              </button>
            </div>
          </label>

          <!-- 登录按钮 -->
          <button
            type="submit"
            class="btn btn-primary h-12 text-base font-bold shadow-lg shadow-primary/25 active:scale-[0.98] transition-transform"
            :disabled="loading"
          >
            <span v-if="loading" class="loading loading-spinner loading-sm"></span>
            {{ loading ? '登录中...' : '登 录' }}
          </button>
        </form>

        <!-- 分隔线 -->
        <div class="relative flex items-center">
          <div class="flex-grow border-t border-base-300"></div>
          <span class="mx-4 text-xs text-base-content/40 font-medium">管理员系统</span>
          <div class="flex-grow border-t border-base-300"></div>
        </div>
      </div>

      <!-- 版权 -->
      <p class="mt-10 text-xs text-base-content/35 text-center">
        © {{ new Date().getFullYear() }} 球队管理后台. 仅限授权管理员使用
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '@/services/auth'
import { setToken } from '@/utils/auth'
import { useAdminStore } from '@/stores/admin'

const router = useRouter()
const adminStore = useAdminStore()

const loading = ref(false)
const error = ref('')
const showPassword = ref(false)

const form = reactive({
  username: '',
  password: '',
})

const handleLogin = async () => {
  error.value = ''
  loading.value = true
  try {
    const res = await login({ username: form.username, password: form.password })
    setToken(res.access_token)
    adminStore.setAdmin({
      id: res.admin.id,
      username: res.admin.username,
      nickname: res.admin.nickname,
      is_super_admin: res.admin.is_super_admin,
    })
    router.push('/dashboard')
  } catch (e: unknown) {
    error.value = (e as Error).message || '登录失败，请检查账号和密码'
  } finally {
    loading.value = false
  }
}
</script>
