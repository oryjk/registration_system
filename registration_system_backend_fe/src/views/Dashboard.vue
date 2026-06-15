<template>
  <div class="flex flex-col gap-6">
    <div>
      <h2 class="text-xl font-bold">仪表盘</h2>
      <p class="text-sm text-base-content/60 mt-0.5">
        欢迎回来，{{ adminInfo?.nickname || adminInfo?.username }}
      </p>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <!-- 骨架屏 -->
      <template v-if="loading">
        <div v-for="i in 4" :key="i" class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body p-5">
            <div class="flex items-center justify-between">
              <div class="skeleton h-4 w-16"></div>
              <div class="skeleton h-9 w-9 rounded-lg"></div>
            </div>
            <div class="skeleton h-8 w-20 mt-2"></div>
          </div>
        </div>
      </template>
      <!-- 真实数据 -->
      <template v-else>
        <div
          v-for="card in statCards"
          :key="card.label"
          class="card bg-base-100 border border-base-300 shadow-sm"
        >
          <div class="card-body p-5">
            <div class="flex items-center justify-between">
              <p class="text-sm text-base-content/60 font-medium">{{ card.label }}</p>
              <div class="w-9 h-9 rounded-lg flex items-center justify-center" :class="card.iconBg">
                <span class="text-lg">{{ card.icon }}</span>
              </div>
            </div>
            <p class="text-2xl font-bold mt-2">{{ card.value }}</p>
            <p v-if="loadError" class="text-xs text-error mt-1">{{ loadError }}</p>
          </div>
        </div>
      </template>
    </div>

    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body">
        <h3 class="card-title text-base">快速入口</h3>
        <div class="flex flex-wrap gap-3 mt-2">
          <RouterLink to="/teams" class="btn btn-outline btn-sm gap-2">
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
            球队管理
          </RouterLink>
          <RouterLink to="/activities" class="btn btn-outline btn-sm gap-2">
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
            比赛报名
          </RouterLink>
          <RouterLink to="/challenges" class="btn btn-outline btn-sm gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M19 4h-4V2h-2v2h-2V2H9v2H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h6v-2H5V10h14v1h2V6c0-1.1-.9-2-2-2zm0 4H5V6h14v2zm-5.16 10.26 1.41 1.41L20 14.92l-1.41-1.41-4.75 4.75zm6.21 1.47-.85-.85-1.41 1.41.85.85H20v-1.27z"
              />
            </svg>
            约队管理
          </RouterLink>
          <RouterLink to="/billing" class="btn btn-outline btn-sm gap-2">
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
            账单管理
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { fetchDashboardStats, type DashboardStats } from '@/services/dashboard'

const adminStore = useAdminStore()
const adminInfo = computed(() => adminStore.adminInfo)

const loading = ref(false)
const loadError = ref('')
const stats = ref<DashboardStats | null>(null)

const statCards = computed(() => {
  const s = stats.value
  return [
    { label: '球队总数', icon: '⚽', iconBg: 'bg-primary/10', value: s?.teamCount ?? '—' },
    {
      label: '比赛总数',
      icon: '📅',
      iconBg: 'bg-success/10',
      value: s?.monthlyActivityCount ?? '—',
    },
    { label: '注册用户', icon: '👤', iconBg: 'bg-info/10', value: s?.playerCount ?? '—' },
    { label: '费用快照', icon: '💰', iconBg: 'bg-warning/10', value: s?.feeSnapshotCount ?? '—' },
  ]
})

onMounted(async () => {
  loading.value = true
  loadError.value = ''
  try {
    stats.value = await fetchDashboardStats()
  } catch (e: unknown) {
    loadError.value = (e as Error).message || '加载统计数据失败'
  } finally {
    loading.value = false
  }
})
</script>
