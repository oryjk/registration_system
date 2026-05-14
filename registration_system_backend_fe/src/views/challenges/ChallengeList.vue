<template>
  <div class="flex flex-col gap-6">
    <section
      class="sticky top-16 z-10 -mx-4 flex flex-col gap-4 bg-base-200 px-4 pb-3 pt-4 lg:-mx-6 lg:px-6"
    >
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold">约队管理</h2>
          <p class="mt-0.5 text-sm text-base-content/60">
            已切成全局运营视角，可按球队、关键词、状态和排序查看当前约队盘面。
          </p>
        </div>
        <button class="btn btn-outline btn-sm" :disabled="loading" @click="fetchChallenges">
          刷新
        </button>
      </div>

      <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div class="stat rounded-xl border border-base-300 bg-base-100 px-5 py-4 shadow-sm">
          <div class="stat-title text-xs">当前结果</div>
          <div class="stat-value text-2xl">{{ challenges.length }}</div>
        </div>
        <div class="stat rounded-xl border border-base-300 bg-base-100 px-5 py-4 shadow-sm">
          <div class="stat-title text-xs">可接约</div>
          <div class="stat-value text-2xl text-success">{{ openCount }}</div>
        </div>
        <div class="stat rounded-xl border border-base-300 bg-base-100 px-5 py-4 shadow-sm">
          <div class="stat-title text-xs">已约成</div>
          <div class="stat-value text-2xl text-info">{{ matchedCount }}</div>
        </div>
        <div class="stat rounded-xl border border-base-300 bg-base-100 px-5 py-4 shadow-sm">
          <div class="stat-title text-xs">已取消</div>
          <div class="stat-value text-2xl text-base-content/50">{{ cancelledCount }}</div>
        </div>
      </div>

      <div class="rounded-xl border border-base-300 bg-base-100 px-4 py-4 shadow-sm">
        <div class="grid grid-cols-1 gap-3 xl:grid-cols-5">
          <label class="form-control">
            <div class="label py-1">
              <span class="label-text text-xs text-base-content/60">球队筛选</span>
            </div>
            <select v-model="selectedTeamId" class="select select-bordered" :disabled="loading" @change="fetchChallenges">
              <option value="">全部可见球队</option>
              <option v-for="team in teamOptions" :key="team.id" :value="team.id">
                {{ team.name }}
              </option>
            </select>
          </label>

          <label class="form-control xl:col-span-2">
            <div class="label py-1">
              <span class="label-text text-xs text-base-content/60">关键词</span>
            </div>
            <div class="join w-full">
              <input
                v-model.trim="keyword"
                class="input input-bordered join-item w-full"
                placeholder="搜标题、主客队、场地"
                :disabled="loading"
                @keyup.enter="fetchChallenges"
              />
              <button class="btn btn-primary join-item" :disabled="loading" @click="fetchChallenges">
                搜索
              </button>
            </div>
          </label>

          <label class="form-control">
            <div class="label py-1">
              <span class="label-text text-xs text-base-content/60">排序</span>
            </div>
            <select v-model="sort" class="select select-bordered" :disabled="loading" @change="fetchChallenges">
              <option value="holding_date_asc">比赛时间优先</option>
              <option value="holding_date_desc">时间倒序</option>
              <option value="created_at_desc">最新发布</option>
              <option value="credit_desc">信用优先</option>
            </select>
          </label>

          <label class="label cursor-pointer gap-3 rounded-xl border border-base-300 px-3 py-2 xl:mt-8">
            <span class="label-text text-sm">包含已取消</span>
            <input
              v-model="includeClosed"
              type="checkbox"
              class="toggle toggle-sm toggle-primary"
              @change="fetchChallenges"
            />
          </label>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="filter in statusFilters"
            :key="filter.value"
            class="btn btn-sm"
            :class="statusFilter === filter.value ? 'btn-primary' : 'btn-outline'"
            @click="applyStatusFilter(filter.value)"
          >
            {{ filter.label }}
          </button>
        </div>
      </div>
    </section>

    <div v-if="loading" class="grid grid-cols-1 gap-4 2xl:grid-cols-2">
      <div v-for="i in 4" :key="i" class="card border border-base-300 bg-base-100 shadow-sm">
        <div class="card-body gap-4 p-5">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-2">
              <div class="skeleton h-6 w-40"></div>
              <div class="skeleton h-4 w-56"></div>
            </div>
            <div class="skeleton h-4 w-20"></div>
          </div>
          <div class="skeleton h-24 w-full rounded-2xl"></div>
          <div class="flex gap-2">
            <div class="skeleton h-6 w-16 rounded-full"></div>
            <div class="skeleton h-6 w-16 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="loadError" class="alert alert-error">
      <span>{{ loadError }}</span>
      <button class="btn btn-sm btn-ghost" @click="fetchChallenges">重试</button>
    </div>

    <div
      v-else-if="challenges.length === 0"
      class="card border border-base-300 bg-base-100 shadow-sm"
    >
      <div class="card-body items-center py-16 text-center text-base-content/50">
        <p class="text-base font-semibold">当前条件下没有约队记录</p>
        <p class="text-sm">可以切换球队、状态或关键词重新查询。</p>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 2xl:grid-cols-2">
      <article
        v-for="item in challenges"
        :key="item.challenge.id"
        class="card cursor-pointer border border-base-300 bg-base-100 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        @click="goDetail(item.challenge.id)"
      >
        <div class="card-body gap-4 p-5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="truncate text-lg font-bold">{{ item.challenge.title }}</h3>
                <span class="badge" :class="statusBadgeClass(item.challenge.status)">
                  {{ statusLabel(item.challenge.status) }}
                </span>
              </div>
              <p class="mt-1 text-sm text-base-content/60">
                {{ formatDateTime(item.challenge.holding_date) }} · {{ item.challenge.location }}
              </p>
            </div>
            <div class="text-right text-xs text-base-content/50">
              <p>创建于</p>
              <p>{{ formatDateTime(item.challenge.created_at) }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 rounded-2xl border border-base-300 bg-base-200/40 p-4 md:grid-cols-2">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-base-content/45">发起球队</p>
              <p class="mt-1 font-semibold">{{ item.host_team_name }}</p>
              <p class="mt-1 text-sm text-base-content/60">
                信用 {{ item.host_team_credit_score }} · {{ item.host_team_trust_label }}
              </p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-base-content/45">接约球队</p>
              <p class="mt-1 font-semibold">{{ item.guest_team_name || '等待接约' }}</p>
              <p class="mt-1 text-sm text-base-content/60">
                {{
                  item.guest_team_name
                    ? `信用 ${item.guest_team_credit_score ?? '-'} · ${item.guest_team_trust_label ?? '待评级'}`
                    : '尚未生成对阵'
                }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <span class="badge badge-outline">{{ item.challenge.players_per_team }} 人制</span>
            <span class="badge badge-outline">{{ feeLabel(item.challenge.fee_per_person) }}</span>
            <span v-if="item.challenge.activity_id" class="badge badge-info badge-outline">已生成比赛</span>
            <span v-if="item.current_team_relation" class="badge badge-neutral badge-outline">
              {{ relationLabel(item.current_team_relation) }}
            </span>
          </div>

          <p v-if="item.challenge.note" class="rounded-2xl bg-base-200/60 px-4 py-3 text-sm text-base-content/70">
            {{ item.challenge.note }}
          </p>

          <div class="card-actions justify-between">
            <button class="btn btn-ghost btn-sm">查看详情</button>
            <RouterLink
              v-if="item.challenge.activity_id"
              :to="`/activities/${item.challenge.activity_id}`"
              class="btn btn-primary btn-sm"
              @click.stop
            >
              查看比赛
            </RouterLink>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { adminListChallenges, type ChallengeStatus, type ChallengeSummary } from '@/services/challenge'
import { adminListTeams, type TeamSummary } from '@/services/team'

type ChallengeStatusFilter = 'all' | ChallengeStatus
type ChallengeSort = 'holding_date_asc' | 'holding_date_desc' | 'created_at_desc' | 'credit_desc'

const router = useRouter()

const teamOptions = ref<TeamSummary[]>([])
const selectedTeamId = ref<number | ''>('')
const keyword = ref('')
const includeClosed = ref(false)
const statusFilter = ref<ChallengeStatusFilter>('all')
const sort = ref<ChallengeSort>('holding_date_asc')
const loading = ref(false)
const loadError = ref('')
const challenges = ref<ChallengeSummary[]>([])

const statusFilters: Array<{ label: string; value: ChallengeStatusFilter }> = [
  { label: '全部状态', value: 'all' },
  { label: '可接约', value: 'open' },
  { label: '已约成', value: 'matched' },
  { label: '已取消', value: 'cancelled' },
]

const openCount = computed(
  () => challenges.value.filter((item) => item.challenge.status === 'open').length,
)
const matchedCount = computed(
  () => challenges.value.filter((item) => item.challenge.status === 'matched').length,
)
const cancelledCount = computed(
  () => challenges.value.filter((item) => item.challenge.status === 'cancelled').length,
)

function statusLabel(status: ChallengeStatus) {
  switch (status) {
    case 'matched':
      return '已约成'
    case 'cancelled':
      return '已取消'
    default:
      return '可接约'
  }
}

function relationLabel(relation: string) {
  switch (relation) {
    case 'host':
      return '发起方'
    case 'guest':
      return '接约方'
    default:
      return '大厅可见'
  }
}

function statusBadgeClass(status: ChallengeStatus) {
  switch (status) {
    case 'matched':
      return 'badge-info'
    case 'cancelled':
      return 'badge-ghost'
    default:
      return 'badge-success'
  }
}

function formatDateTime(value: string) {
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function feeLabel(value: string | null) {
  if (!value) return '费用待定'
  return `¥${Number(value).toFixed(2)}/人`
}

async function fetchTeams() {
  teamOptions.value = await adminListTeams()
}

async function fetchChallenges() {
  loading.value = true
  loadError.value = ''
  try {
    challenges.value = await adminListChallenges({
      team_id: selectedTeamId.value || undefined,
      keyword: keyword.value || undefined,
      status: statusFilter.value === 'all' ? undefined : statusFilter.value,
      include_closed: includeClosed.value,
      limit: 100,
      sort: sort.value,
    })
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '约队列表加载失败'
  } finally {
    loading.value = false
  }
}

function applyStatusFilter(nextValue: ChallengeStatusFilter) {
  statusFilter.value = nextValue
  void fetchChallenges()
}

function goDetail(challengeId: string) {
  router.push(`/challenges/${challengeId}`)
}

onMounted(async () => {
  loading.value = true
  loadError.value = ''
  try {
    await fetchTeams()
    await fetchChallenges()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '约队数据加载失败'
  } finally {
    loading.value = false
  }
})
</script>
