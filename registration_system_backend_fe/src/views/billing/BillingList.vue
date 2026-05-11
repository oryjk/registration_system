<template>
  <div class="flex flex-col gap-6">
    <div>
      <h2 class="text-xl font-bold">账单管理</h2>
      <p class="text-sm text-base-content/60 mt-0.5">查看活动账单汇总、用户余额与交易流水</p>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="flex flex-col gap-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="stat bg-base-100 border border-base-300 rounded-xl shadow-sm py-4 px-5">
          <div class="skeleton h-3 w-14 mb-2"></div>
          <div class="skeleton h-8 w-24"></div>
        </div>
      </div>
      <div class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="p-4">
          <div class="skeleton h-6 w-32 mb-4"></div>
          <div class="space-y-3">
            <div v-for="i in 5" :key="i" class="flex gap-4">
              <div class="skeleton h-4 w-16"></div>
              <div class="skeleton h-4 w-40"></div>
              <div class="skeleton h-4 w-24"></div>
              <div class="skeleton h-4 w-32"></div>
              <div class="skeleton h-4 w-12"></div>
              <div class="skeleton h-4 w-16"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 错误 -->
    <div v-else-if="loadError" class="alert alert-error">
      <span>{{ loadError }}</span>
      <button class="btn btn-sm btn-ghost" @click="fetchAll">重试</button>
    </div>

    <template v-else>
      <!-- 统计卡片 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div class="stat bg-base-100 border border-base-300 rounded-xl shadow-sm py-4 px-5">
          <div class="stat-title text-xs">总余额</div>
          <div class="stat-value text-2xl">{{ formatAmount(totalBalance) }}</div>
        </div>
        <div class="stat bg-base-100 border border-base-300 rounded-xl shadow-sm py-4 px-5">
          <div class="stat-title text-xs">总充值</div>
          <div class="stat-value text-2xl text-success">{{ formatAmount(totalRecharge) }}</div>
        </div>
        <div class="stat bg-base-100 border border-base-300 rounded-xl shadow-sm py-4 px-5">
          <div class="stat-title text-xs">总消费</div>
          <div class="stat-value text-2xl text-error">{{ formatAmount(totalExpense) }}</div>
        </div>
        <div class="stat bg-base-100 border border-base-300 rounded-xl shadow-sm py-4 px-5">
          <div class="stat-title text-xs">总罚金</div>
          <div class="stat-value text-2xl text-warning">{{ formatAmount(totalPenalty) }}</div>
        </div>
      </div>

      <!-- Tab 切换 -->
      <div class="tabs tabs-boxed bg-base-200 w-fit">
        <button
          class="tab"
          :class="activeTab === 'activities' ? 'tab-active' : ''"
          @click="activeTab = 'activities'"
        >
          活动账单
        </button>
        <button
          class="tab"
          :class="activeTab === 'users' ? 'tab-active' : ''"
          @click="activeTab = 'users'"
        >
          用户账户
        </button>
      </div>

      <!-- 活动账单表 -->
      <div v-if="activeTab === 'activities'" class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>月份</th>
                <th>活动名称</th>
                <th>日期</th>
                <th>地点</th>
                <th>人数</th>
                <th>费用/人</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="activityBillings.length === 0">
                <td colspan="6" class="text-center py-12 text-base-content/40">暂无活动账单</td>
              </tr>
              <tr v-for="item in activityBillings" :key="`${item.activity_id}-${item.user_id ?? 'all'}`">
                <td>
                  <span class="badge badge-outline badge-sm">{{ item.month_key }}</span>
                </td>
                <td class="font-medium">{{ item.activity_name }}</td>
                <td class="text-sm text-base-content/60">{{ formatDate(item.holding_date) }}</td>
                <td class="text-sm text-base-content/60">{{ item.location }}</td>
                <td>{{ item.total ?? '—' }}</td>
                <td class="font-mono">{{ item.fee ? `¥${item.fee}` : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 用户账户表 -->
      <div v-if="activeTab === 'users'" class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>用户 ID</th>
                <th>余额</th>
                <th>总充值</th>
                <th>总消费</th>
                <th>总罚金</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="userBillings.length === 0">
                <td colspan="5" class="text-center py-12 text-base-content/40">暂无用户账单</td>
              </tr>
              <tr v-for="item in userBillings" :key="item.user_id">
                <td class="text-base-content/60">{{ item.user_id }}</td>
                <td class="font-mono font-semibold">{{ formatAmount(item.balance) }}</td>
                <td class="font-mono text-success">{{ formatAmount(item.total_recharge) }}</td>
                <td class="font-mono text-error">{{ formatAmount(item.total_expense) }}</td>
                <td class="font-mono text-warning">{{ formatAmount(item.total_penalty) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  getActivitiesBilling,
  getUsersBilling,
  type ActivityBillingSummary,
  type UserAccountSummary,
} from '@/services/billing'

const loading = ref(false)
const loadError = ref('')
const activeTab = ref<'activities' | 'users'>('activities')

const activityBillings = ref<ActivityBillingSummary[]>([])
const userBillings = ref<UserAccountSummary[]>([])

const totalBalance = computed(() =>
  userBillings.value.reduce((s, u) => s + Number(u.balance), 0),
)
const totalRecharge = computed(() =>
  userBillings.value.reduce((s, u) => s + Number(u.total_recharge), 0),
)
const totalExpense = computed(() =>
  userBillings.value.reduce((s, u) => s + Number(u.total_expense), 0),
)
const totalPenalty = computed(() =>
  userBillings.value.reduce((s, u) => s + Number(u.total_penalty), 0),
)

const formatAmount = (value: number | string) => `¥${Number(value).toFixed(2)}`

const formatDate = (d: string) => {
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const fetchAll = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const [activities, users] = await Promise.all([
      getActivitiesBilling(),
      getUsersBilling(),
    ])
    activityBillings.value = activities
    userBillings.value = users
  } catch (e: unknown) {
    loadError.value = (e as Error).message || '加载账单失败'
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)
</script>
