<template>
  <div class="flex min-h-screen bg-base-200">
    <!-- 侧边栏 -->
    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-base-300/80 bg-base-100 shadow-lg transition-all duration-300"
      :class="[
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-56',
      ]"
    >
      <button
        class="absolute -right-3 top-20 z-10 hidden h-8 w-8 items-center justify-center rounded-full border border-base-300 bg-base-100 text-base-content/60 shadow-md transition-all hover:border-primary/30 hover:text-primary lg:inline-flex"
        :title="sidebarCollapsed ? '展开菜单' : '折叠菜单'"
        @click="toggleSidebarCollapsed"
      >
        <svg
          v-if="sidebarCollapsed"
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M10 17l5-5-5-5v10z" />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M14 7l-5 5 5 5V7z" />
        </svg>
      </button>

      <!-- Logo -->
      <div
        class="flex h-16 items-center border-b border-base-300"
        :class="sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-4'"
      >
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
        <div v-if="!sidebarCollapsed" class="min-w-0">
          <span class="block truncate text-lg font-bold tracking-tight">球队管理后台</span>
          <span class="block text-xs text-base-content/45">Team Admin Console</span>
        </div>
      </div>

      <!-- 导航菜单 -->
      <nav class="flex-1 overflow-y-auto" :class="sidebarCollapsed ? 'px-2 py-3' : 'px-3 py-4'">
        <ul class="menu menu-md gap-1 p-0">
          <li v-for="item in navItems" :key="item.to">
            <RouterLink
              :to="item.to"
              :title="sidebarCollapsed ? item.label : undefined"
              class="group flex items-center rounded-2xl text-base-content/70 transition-all duration-200 hover:bg-primary/15 hover:text-primary"
              :class="
                sidebarCollapsed
                  ? 'mx-auto h-12 w-12 justify-center rounded-xl px-0 py-0'
                  : 'gap-3 px-4 py-3'
              "
              :active-class="activeNavClass"
              @click="handleNavClick"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path :d="item.icon" />
              </svg>
              <span v-if="!sidebarCollapsed" class="truncate">{{ item.label }}</span>
            </RouterLink>
          </li>

          <!-- 超管专属 -->
          <template v-if="isSuperAdmin">
            <li v-if="!sidebarCollapsed" class="mt-2">
              <div
                class="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-base-content/40"
              >
                超级管理员
              </div>
            </li>
            <li v-for="item in adminNavItems" :key="item.to">
              <RouterLink
                :to="item.to"
                :title="sidebarCollapsed ? item.label : undefined"
                class="group flex items-center rounded-2xl text-base-content/70 transition-all duration-200 hover:bg-primary/15 hover:text-primary"
                :class="
                  sidebarCollapsed
                    ? 'mx-auto h-12 w-12 justify-center rounded-xl px-0 py-0'
                    : 'gap-3 px-4 py-3'
                "
                :active-class="activeNavClass"
                @click="handleNavClick"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path :d="item.icon" />
                </svg>
                <span v-if="!sidebarCollapsed" class="truncate">{{ item.label }}</span>
              </RouterLink>
            </li>
          </template>
        </ul>
      </nav>

      <!-- 底部用户信息 -->
      <div class="border-t border-base-300 p-3">
        <div
          class="flex rounded-lg px-2 py-2"
          :class="sidebarCollapsed ? 'flex-col items-center gap-2' : 'items-center gap-3'"
        >
          <div class="avatar placeholder">
            <div class="w-9 rounded-full bg-primary text-primary-content">
              <span class="text-sm font-bold">{{
                adminInfo?.nickname?.charAt(0) || adminInfo?.username?.charAt(0) || 'A'
              }}</span>
            </div>
          </div>
          <div v-if="!sidebarCollapsed" class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">
              {{ adminInfo?.nickname || adminInfo?.username }}
            </p>
            <p class="text-xs text-base-content/50">
              {{ adminInfo?.is_super_admin ? '超级管理员' : '管理员' }}
            </p>
          </div>
          <div class="dropdown dropdown-top dropdown-end">
            <button tabindex="0" class="btn btn-ghost btn-xs btn-square">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                />
              </svg>
            </button>
            <ul
              tabindex="0"
              class="dropdown-content menu menu-sm z-50 w-40 rounded-lg bg-base-100 p-1 shadow-lg border border-base-300"
            >
              <li>
                <button @click="toggleTheme">{{ isDark ? '☀️ 亮色模式' : '🌙 深色模式' }}</button>
              </li>
              <li><button class="text-error" @click="handleLogout">退出登录</button></li>
            </ul>
          </div>
        </div>
      </div>
    </aside>

    <!-- 移动端遮罩 -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-30 bg-black/50 lg:hidden"
      @click="sidebarOpen = false"
    />

    <!-- 主内容区 -->
    <div
      class="flex flex-1 flex-col transition-all duration-300"
      :class="sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-56'"
    >
      <!-- 顶部栏 -->
      <header
        class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-base-300 bg-base-100 px-4 lg:px-6"
      >
        <button class="btn btn-ghost btn-square lg:hidden" @click="sidebarOpen = !sidebarOpen">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        </button>
        <h1 class="text-base font-semibold">{{ pageTitle }}</h1>
      </header>

      <!-- 页面内容 -->
      <main class="flex-1 p-4 lg:p-6">
        <RouterView />
      </main>
    </div>

    <!-- 全局 Toast -->
    <div class="toast toast-end toast-bottom z-[100]">
      <TransitionGroup name="toast">
        <div
          v-for="item in toasts"
          :key="item.id"
          class="alert shadow-lg"
          :class="{
            'alert-success': item.type === 'success',
            'alert-error': item.type === 'error',
            'alert-warning': item.type === 'warning',
            'alert-info': item.type === 'info',
          }"
        >
          <span class="text-sm">{{ item.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAdminStore } from '@/stores/admin'
import { applyTheme, saveTheme, getInitialTheme } from '@/utils/theme'

interface NavItem {
  to: string
  label: string
  icon: string
}

import { useToasts } from '@/utils/toast'

const toasts = useToasts()

const SIDEBAR_COLLAPSED_KEY = 'layout.sidebarCollapsed.v2'

const navItems: NavItem[] = [
  {
    to: '/dashboard',
    label: '仪表盘',
    icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  },
  {
    to: '/teams',
    label: '球队管理',
    icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  },
  {
    to: '/challenges',
    label: '约队管理',
    icon: 'M19 4h-4V2h-2v2h-2V2H9v2H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h6v-2H5V10h14v1h2V6c0-1.1-.9-2-2-2zm0 4H5V6h14v2zm-5.16 10.26 1.41 1.41L20 14.92l-1.41-1.41-4.75 4.75zm6.21 1.47-.85-.85-1.41 1.41.85.85H20v-1.27z',
  },
  {
    to: '/activities',
    label: '活动报名',
    icon: 'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
  },
  {
    to: '/billing',
    label: '账单管理',
    icon: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
  },
  {
    to: '/players',
    label: '球员管理',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z',
  },
]

const adminNavItems: NavItem[] = [
  {
    to: '/admins',
    label: '管理员管理',
    icon: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
  },
  {
    to: '/system/settings',
    label: '系统设置',
    icon: 'M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.6-.22l-2.39.96a7.14 7.14 0 00-1.63-.94l-.36-2.54a.5.5 0 00-.5-.42h-3.84a.5.5 0 00-.5.42l-.36 2.54c-.58.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 00-.6.22L2.65 8.84a.5.5 0 00.12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 00-.12.64l1.92 3.32a.5.5 0 00.6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 00.5.42h3.84a.5.5 0 00.5-.42l.36-2.54c.58-.23 1.13-.54 1.63-.94l2.39.96a.5.5 0 00.6-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1112 8a3.5 3.5 0 010 7.5z',
  },
]

const loadSidebarCollapsed = () => {
  if (typeof window === 'undefined') return false
  const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
  return stored === null ? false : stored === 'true'
}

const router = useRouter()
const route = useRoute()
const adminStore = useAdminStore()

const sidebarOpen = ref(false)
const sidebarCollapsed = ref(loadSidebarCollapsed())
const adminInfo = computed(() => adminStore.adminInfo)
const isSuperAdmin = computed(() => adminStore.isSuperAdmin)
const activeNavClass = computed(() =>
  sidebarCollapsed.value
    ? '!bg-primary !text-primary-content shadow-sm'
    : '!bg-primary !text-primary-content font-semibold shadow-sm',
)

const currentTheme = ref(getInitialTheme())
const isDark = computed(() => currentTheme.value === 'dark')

const pageTitle = computed(() => (route.meta.title as string) || '球队管理后台')

const handleNavClick = () => {
  sidebarOpen.value = false
}

const toggleSidebarCollapsed = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed.value))
  }
}

const toggleTheme = () => {
  currentTheme.value = isDark.value ? 'light' : 'dark'
  applyTheme(currentTheme.value)
  saveTheme(currentTheme.value)
}

const handleLogout = () => {
  adminStore.clearAdmin()
  router.push('/login')
}
</script>
