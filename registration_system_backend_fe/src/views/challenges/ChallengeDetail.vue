<template>
  <div v-if="loading" class="flex flex-col gap-6">
    <div class="flex items-center gap-2">
      <div class="skeleton h-4 w-16"></div>
      <div class="skeleton h-4 w-4"></div>
      <div class="skeleton h-5 w-40"></div>
    </div>
    <section class="card border border-base-300 bg-base-100 shadow-sm">
      <div class="card-body gap-5 p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <div class="skeleton h-8 w-48"></div>
              <div class="skeleton h-6 w-16 rounded-full"></div>
            </div>
            <div class="skeleton h-4 w-64"></div>
          </div>
          <div class="flex gap-2">
            <div class="skeleton h-9 w-20"></div>
          </div>
        </div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div v-for="i in 4" :key="i" class="rounded-2xl border border-base-300 bg-base-200/40 p-4 space-y-2">
            <div class="skeleton h-3 w-16"></div>
            <div class="skeleton h-6 w-20"></div>
          </div>
        </div>
      </div>
    </section>
  </div>

  <div v-else-if="loadError" class="alert alert-error">
    <span>{{ loadError }}</span>
    <button class="btn btn-sm btn-ghost" @click="fetchDetail">重试</button>
  </div>

  <div v-else-if="detail" class="flex flex-col gap-6">
    <div class="flex items-center gap-2 text-sm text-base-content/50">
      <RouterLink :to="backRoute" class="hover:text-primary transition-colors">{{ detailTitle }}</RouterLink>
      <span>/</span>
      <span class="text-base-content font-medium">{{ detail.summary.challenge.title }}</span>
    </div>

    <section class="card border border-base-300 bg-base-100 shadow-sm">
      <div class="card-body gap-5 p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-2xl font-bold">{{ detail.summary.challenge.title }}</h2>
              <span class="badge" :class="statusBadgeClass(detail.summary.challenge.status)">
                {{ statusLabel(detail.summary.challenge.status) }}
              </span>
            </div>
            <p class="mt-2 text-sm text-base-content/60">
              {{ formatDateTime(detail.summary.challenge.holding_date) }} ·
              {{ detail.summary.challenge.location }}
            </p>
          </div>

          <div class="flex gap-2">
            <RouterLink :to="backRoute" class="btn btn-outline btn-sm">返回列表</RouterLink>
            <button
              class="btn btn-outline btn-sm"
              :disabled="detail.summary.challenge.status !== 'open' || saving"
              @click="openEditDialog"
            >
              编辑
            </button>
            <button
              class="btn btn-error btn-outline btn-sm"
              :disabled="detail.summary.challenge.status !== 'open' || saving"
              @click="openCancelDialog"
            >
              删除
            </button>
            <RouterLink
              v-if="detail.activity"
              :to="`/activities/${detail.activity.id}`"
              class="btn btn-primary btn-sm"
            >
              查看比赛
            </RouterLink>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-2xl border border-base-300 bg-base-200/40 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-base-content/45">人数规格</p>
            <p class="mt-2 text-lg font-bold">{{ detail.summary.challenge.players_per_team }} 人制</p>
          </div>
          <div class="rounded-2xl border border-base-300 bg-base-200/40 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-base-content/45">费用预估</p>
            <p class="mt-2 text-lg font-bold">{{ feeLabel(detail.summary.challenge.fee_per_person) }}</p>
          </div>
          <div class="rounded-2xl border border-base-300 bg-base-200/40 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-base-content/45">创建时间</p>
            <p class="mt-2 text-lg font-bold">{{ formatDateTime(detail.summary.challenge.created_at) }}</p>
          </div>
          <div class="rounded-2xl border border-base-300 bg-base-200/40 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-base-content/45">最后更新</p>
            <p class="mt-2 text-lg font-bold">{{ formatDateTime(detail.summary.challenge.updated_at) }}</p>
          </div>
        </div>

        <p
          v-if="detail.summary.challenge.note"
          class="rounded-2xl bg-base-200/60 px-4 py-3 text-sm leading-6 text-base-content/75"
        >
          {{ detail.summary.challenge.note }}
        </p>
      </div>
    </section>

    <section class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <article class="card border border-base-300 bg-base-100 shadow-sm">
        <div class="card-body p-5">
          <h3 class="card-title text-base">球队信用信息</h3>
          <div class="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div class="rounded-2xl border border-base-300 bg-base-200/40 p-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-base-content/45">发起球队</p>
              <p class="mt-2 text-lg font-bold">{{ detail.summary.host_team_name }}</p>
              <p class="mt-1 text-sm text-base-content/60">
                信用 {{ detail.summary.host_team_credit_score }} · {{ detail.summary.host_team_trust_label }}
              </p>
            </div>
            <div class="rounded-2xl border border-base-300 bg-base-200/40 p-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-base-content/45">接约球队</p>
              <p class="mt-2 text-lg font-bold">{{ detail.summary.guest_team_name || '等待接约' }}</p>
              <p class="mt-1 text-sm text-base-content/60">
                {{
                  detail.summary.guest_team_name
                    ? `信用 ${detail.summary.guest_team_credit_score ?? '-'} · ${detail.summary.guest_team_trust_label ?? '待评级'}`
                    : '尚未确定对手'
                }}
              </p>
            </div>
          </div>
        </div>
      </article>

      <article class="card border border-base-300 bg-base-100 shadow-sm">
        <div class="card-body p-5">
          <h3 class="card-title text-base">对阵生成状态</h3>
          <div class="mt-3 space-y-3">
            <div class="rounded-2xl border border-base-300 bg-base-200/40 p-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-base-content/45">约队状态</p>
              <p class="mt-2 text-lg font-bold">{{ statusLabel(detail.summary.challenge.status) }}</p>
              <p class="mt-1 text-sm text-base-content/60">
                {{
                  detail.activity
                    ? '这条约队已经生成真实比赛，后续报名和互评都在比赛模块完成。'
                    : detail.summary.challenge.status === 'cancelled'
                      ? '当前约队已取消，不会再生成比赛。'
                      : '等待其他球队接约，成功后会自动创建活动。'
                }}
              </p>
            </div>

            <div v-if="detail.activity" class="rounded-2xl border border-info/20 bg-info/5 p-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-info/70">关联比赛</p>
              <p class="mt-2 text-lg font-bold">{{ detail.activity.name }}</p>
              <p class="mt-1 text-sm text-base-content/70">
                {{ formatDateTime(detail.activity.holding_date) }} · {{ detail.activity.location }}
              </p>
            </div>
          </div>
        </div>
      </article>
    </section>

    <section v-if="isIndividualChallenge" class="card border border-base-300 bg-base-100 shadow-sm">
      <div class="card-body p-5">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 class="card-title text-base">报名人员</h3>
          <span class="text-sm text-base-content/60">
            {{ detail.summary.accepted_count }} / {{ individualCapacity }} 已报名
          </span>
        </div>

        <div v-if="detail.individual_participants.length" class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="participant in detail.individual_participants"
            :key="participant.user_id"
            class="flex items-center gap-3 rounded-2xl border border-base-300 bg-base-200/40 p-3"
          >
            <div class="avatar placeholder">
              <div class="h-11 w-11 overflow-hidden rounded-full bg-primary/10 text-primary">
                <img
                  v-if="participant.avatar_url"
                  :src="participant.avatar_url"
                  :alt="participant.display_name"
                  class="h-full w-full object-cover"
                />
                <span v-else class="text-sm font-bold">{{ participantInitial(participant.display_name) }}</span>
              </div>
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold">{{ participant.display_name }}</p>
              <p class="mt-0.5 text-xs text-base-content/50">用户 ID {{ participant.user_id }}</p>
            </div>
          </div>
        </div>

        <p v-else class="mt-4 rounded-2xl border border-dashed border-base-300 bg-base-200/40 px-4 py-6 text-center text-sm text-base-content/50">
          暂无报名人员
        </p>
      </div>
    </section>

    <ChallengeEditDialog
      :open="editOpen"
      :challenge="detail.summary.challenge"
      :saving="saving"
      :error="actionError"
      @close="closeEditDialog"
      @submit="submitEdit"
    />
    <ChallengeCancelDialog
      :open="cancelOpen"
      :challenge="detail.summary.challenge"
      :saving="saving"
      :error="actionError"
      @close="closeCancelDialog"
      @confirm="submitCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  cancelAdminChallenge,
  getAdminChallengeDetail,
  type ChallengeDetail,
  type ChallengeStatus,
  type UpdateChallengePayload,
  updateAdminChallenge,
} from '@/services/challenge'
import ChallengeCancelDialog from './ChallengeCancelDialog.vue'
import ChallengeEditDialog from './ChallengeEditDialog.vue'

const route = useRoute()

const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const actionError = ref('')
const detail = ref<ChallengeDetail | null>(null)
const editOpen = ref(false)
const cancelOpen = ref(false)

const isIndividualChallenge = computed(() => detail.value?.summary.challenge.kind === 'individual')
const detailTitle = computed(() => (isIndividualChallenge.value ? '散人报名' : '约队管理'))
const backRoute = computed(() => (isIndividualChallenge.value ? '/individual-registrations' : '/challenges'))
const individualCapacity = computed(() => {
  const playersPerTeam = detail.value?.summary.challenge.players_per_team ?? 0
  return playersPerTeam * 2
})

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
    year: 'numeric',
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

function participantInitial(name: string) {
  return (name.trim().charAt(0) || '?').toUpperCase()
}

function openEditDialog() {
  if (!detail.value) return
  actionError.value = ''
  editOpen.value = true
}

function closeEditDialog() {
  if (saving.value) return
  editOpen.value = false
  actionError.value = ''
}

function openCancelDialog() {
  actionError.value = ''
  cancelOpen.value = true
}

function closeCancelDialog() {
  if (saving.value) return
  cancelOpen.value = false
  actionError.value = ''
}

async function submitEdit(payload: UpdateChallengePayload) {
  if (!detail.value) return

  saving.value = true
  actionError.value = ''
  try {
    await updateAdminChallenge(detail.value.summary.challenge.id, payload)
    editOpen.value = false
    await fetchDetail()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function submitCancel() {
  if (!detail.value) return
  saving.value = true
  actionError.value = ''
  try {
    await cancelAdminChallenge(detail.value.summary.challenge.id)
    cancelOpen.value = false
    await fetchDetail()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : '删除失败'
  } finally {
    saving.value = false
  }
}

async function fetchDetail() {
  loading.value = true
  loadError.value = ''
  try {
    detail.value = await getAdminChallengeDetail(String(route.params.id))
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '约队详情加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchDetail()
})
</script>
