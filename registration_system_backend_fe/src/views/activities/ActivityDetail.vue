<template>
  <div v-if="loading" class="flex flex-col gap-6">
    <div class="flex items-center gap-2">
      <div class="skeleton h-4 w-16"></div>
      <div class="skeleton h-4 w-4"></div>
      <div class="skeleton h-5 w-32"></div>
    </div>
    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body p-5 space-y-4">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <div class="skeleton h-7 w-40"></div>
              <div class="skeleton h-6 w-14 rounded-full"></div>
            </div>
            <div class="flex gap-3">
              <div class="skeleton h-4 w-36"></div>
              <div class="skeleton h-4 w-28"></div>
            </div>
          </div>
          <div class="skeleton h-9 w-16"></div>
        </div>
        <div class="flex flex-wrap gap-4 pt-4 border-t border-base-200">
          <div class="skeleton h-5 w-16"></div>
          <div class="skeleton h-5 w-16"></div>
          <div class="skeleton h-5 w-16"></div>
          <div class="skeleton h-5 w-16"></div>
        </div>
      </div>
    </div>
    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body p-5 space-y-4">
        <div class="skeleton h-5 w-24"></div>
        <div class="space-y-3">
          <div v-for="i in 5" :key="i" class="flex items-center gap-4">
            <div class="skeleton h-10 w-10 rounded-full flex-shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skeleton h-4 w-24"></div>
              <div class="skeleton h-3 w-32"></div>
            </div>
            <div class="skeleton h-6 w-14 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="loadError" class="alert alert-error">
    <span>{{ loadError }}</span>
    <button class="btn btn-sm btn-ghost" @click="fetchAll">重试</button>
  </div>

  <div v-else-if="activity" class="flex flex-col gap-6">
    <!-- 面包屑 -->
    <div class="flex items-center gap-2 text-sm text-base-content/50">
      <RouterLink to="/activities" class="hover:text-primary transition-colors"
        >活动报名</RouterLink
      >
      <span>/</span>
      <span class="text-base-content font-medium">{{ activity.name }}</span>
    </div>

    <ActivitySummaryPanel
      :activity="activity"
      :reg-counts="regCounts"
      :registration-progress="registrationProgress"
      @edit="openEditModal"
    />

    <ActivityCheckInPanel :activity="activity" :team-ids="activityCheckinTeamIds" />

    <ActivitySettlementPanel
      v-model:search-keyword="settlementSearchKeyword"
      :summary="settlementSummary"
      :form="settlementForm"
      :activity-ended="activity?.status === 2"
      :loading="settlementLoading"
      :submitting="settlementSubmitting"
      :error="settlementError"
      :attending-user-count="regCounts.attending"
      :search-results="settlementSearchResults"
      :searching="settlementSearching"
      :player-by-id="settlementPlayerById"
      @mode-change="syncSettlementCharges"
      @scope-change="handleSettlementScopeChange"
      @search-players="handleSettlementPlayerSearch"
      @add-custom-player="addSettlementCustomPlayer"
      @remove-custom-player="removeSettlementCustomPlayer"
      @submit="handleSettlement"
    />

    <ActivityRegistrationTable
      :reg-items="regItems"
      :reg-counts="regCounts"
      :reg-total="regTotal"
      :reg-page="regPage"
      :reg-page-size="regPageSize"
      :reg-total-pages="regTotalPages"
      :reg-filter="regFilter"
      :reg-loading="regLoading"
      :selected-reg-ids="selectedRegIds"
      :all-page-selected="allPageSelected"
      @open-register="openRegisterModal"
      @open-batch-stand="openBatchStandModal"
      @clear-selection="selectedRegIds = []"
      @filter="onRegFilter"
      @page="goRegPage"
      @page-size="onPageSizeChange"
      @toggle-select-all="toggleSelectAll"
      @toggle-reg="toggleSelectReg"
      @change-status="changeRegStatus"
      @cancel="confirmCancel"
    />
  </div>

  <ActivityEditDialog
    ref="editDialogRef"
    v-model:form="editForm"
    :editing="editing"
    :edit-error="editError"
    @clear-location="clearEditLocationCoordinates"
    @open-location="openEditLocationModal"
    @match-format-change="onEditMatchFormatChange"
    @submit="handleEdit"
  />

  <TencentLocationPickerModal
    v-model:open="editLocationPickerOpen"
    :location-title="editForm.location"
    :location-latitude="editForm.location_latitude"
    :location-longitude="editForm.location_longitude"
    @apply="applyEditSelectedLocation"
  />

  <ActivityManualRegistrationDialog
    ref="manualRegistrationDialogRef"
    v-model:keyword="regSearchKw"
    v-model:target="regTarget"
    v-model:stand="regStand"
    :search-results="regSearchResults"
    :searching="regSearching"
    :registering="registering"
    :error="regError"
    @search="onRegSearch"
    @submit="handleRegister"
  />

  <ActivityRegistrationDialogs
    ref="registrationDialogsRef"
    v-model:stand="batchStandValue"
    :selected-reg-count="selectedRegIds.length"
    :batch-stand-submitting="batchStandSubmitting"
    :cancel-target="cancelTarget"
    :cancelling="cancelling"
    @batch-submit="handleBatchUpdateStand"
    @cancel-submit="handleCancel"
  />
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from '@/utils/toast'
import TencentLocationPickerModal from '@/components/TencentLocationPickerModal.vue'
import ActivityCheckInPanel from '@/views/activities/ActivityCheckInPanel.vue'
import ActivityEditDialog from '@/views/activities/ActivityEditDialog.vue'
import ActivityManualRegistrationDialog from '@/views/activities/ActivityManualRegistrationDialog.vue'
import ActivityRegistrationDialogs from '@/views/activities/ActivityRegistrationDialogs.vue'
import ActivityRegistrationTable from '@/views/activities/ActivityRegistrationTable.vue'
import ActivitySettlementPanel from '@/views/activities/ActivitySettlementPanel.vue'
import ActivitySummaryPanel from '@/views/activities/ActivitySummaryPanel.vue'
import {
  getActivitySettlement,
  settleActivityExpense,
  type ActivitySettlementSummary,
} from '@/services/billing'
import {
  getActivity,
  updateActivity,
  updateActivityStatus,
  listRegistrations,
  adminRegister,
  cancelRegistration,
  batchUpdateStand,
  type Activity,
  type RegistrationWithInfo,
  type RegistrationStandCounts,
} from '@/services/activity'
import { listPlayers, type Player } from '@/services/player'
import type { AppliedLocationSelection } from '@/views/activities/location-picker.model'
import {
  buildRegisteredSettlementCharges,
  createSettlementForm,
  patchSettlementFormFromSummary,
  validateSettlementForm,
} from '@/views/activities/settlement.model'
import {
  buildRegistrationProgress,
  inferMatchFormat,
  playersPerTeamFromMatchFormat,
  toLocalDateTimeInput,
  type MatchFormatOption,
} from '@/views/activities/activity-detail.model'

const route = useRoute()
const activityId = computed(() => route.params.id as string)

const activity = ref<Activity | null>(null)
const regItems = ref<RegistrationWithInfo[]>([])
const regCounts = ref<RegistrationStandCounts>({
  total: 0,
  unknown: 0,
  attending: 0,
  leave: 0,
  absent: 0,
})
const regTotal = ref(0)
const regPage = ref(1)
const regPageSize = ref(20)
const loading = ref(false)
const regLoading = ref(false)
const loadError = ref('')
const regFilter = ref(-1)
const selectedRegIds = ref<number[]>([])
const settlementSummary = ref<ActivitySettlementSummary | null>(null)
const settlementLoading = ref(false)
const settlementSubmitting = ref(false)
const settlementError = ref('')
const settlementSearchKeyword = ref('')
const settlementSearchResults = ref<Player[]>([])
const settlementSearching = ref(false)
const settlementPlayerById = computed(() => {
  const entries = [
    ...regItems.value.map((item) => [
      item.user_id,
      {
        id: item.user_id,
        nickname: item.nickname,
        real_name: item.real_name,
        avatar_url: item.avatar_url,
        phone_number: item.phone_number,
        is_venue: false,
        status: 1,
        status_label: '',
        create_time: '',
        latest_login_date: '',
        freeze_start_time: null,
        freeze_end_time: null,
        teams: [],
        team_count: 0,
      } satisfies Player,
    ] as const),
    ...settlementSearchResults.value.map((item) => [item.id, item] as const),
  ]
  return Object.fromEntries(entries)
})
const settlementForm = reactive(createSettlementForm())

const toggleSelectReg = (userId: number) => {
  const idx = selectedRegIds.value.indexOf(userId)
  if (idx === -1) selectedRegIds.value.push(userId)
  else selectedRegIds.value.splice(idx, 1)
}

const allPageSelected = computed(() => {
  if (regItems.value.length === 0) return false
  return regItems.value.every((r) => selectedRegIds.value.includes(r.user_id))
})

const toggleSelectAll = () => {
  if (allPageSelected.value) {
    regItems.value.forEach((r) => {
      const idx = selectedRegIds.value.indexOf(r.user_id)
      if (idx !== -1) selectedRegIds.value.splice(idx, 1)
    })
  } else {
    regItems.value.forEach((r) => {
      if (!selectedRegIds.value.includes(r.user_id)) selectedRegIds.value.push(r.user_id)
    })
  }
}

const regTotalPages = computed(() => Math.max(1, Math.ceil(regTotal.value / regPageSize.value)))

const onRegFilter = async (stand: number) => {
  regFilter.value = stand
  regPage.value = 1
  await fetchRegistrations()
}

const onPageSizeChange = async (pageSize?: number) => {
  if (pageSize) regPageSize.value = pageSize
  regPage.value = 1
  await fetchRegistrations()
}

const goRegPage = async (p: number) => {
  const next = Math.min(Math.max(1, p), regTotalPages.value)
  if (next === regPage.value) return
  regPage.value = next
  await fetchRegistrations()
}

const activityCheckinTeamIds = computed(() =>
  [activity.value?.home_team_id, activity.value?.away_team_id].filter(
    (teamId): teamId is number => typeof teamId === 'number',
  ),
)

const registrationProgress = computed(() =>
  buildRegistrationProgress(activity.value?.players_per_team, regCounts.value),
)

const syncSettlementCharges = () => {
  if (settlementForm.participantScope !== 'registered_attendees') return
  settlementForm.charges = buildRegisteredSettlementCharges(regItems.value, settlementForm.charges)
}

const handleSettlementScopeChange = () => {
  if (settlementForm.participantScope === 'registered_attendees') {
    syncSettlementCharges()
    return
  }
  settlementForm.charges = []
}

const handleSettlementPlayerSearch = async () => {
  const keyword = settlementSearchKeyword.value.trim()
  if (!keyword || settlementSearching.value) return
  settlementSearching.value = true
  try {
    const res = await listPlayers({ keyword, page: 1, page_size: 12 })
    settlementSearchResults.value = res.items
  } catch (e: unknown) {
    toast.error((e as Error).message || '搜索球员失败')
  } finally {
    settlementSearching.value = false
  }
}

const addSettlementCustomPlayer = (player: Player) => {
  if (settlementForm.charges.some((item) => item.userId === player.id)) {
    toast.info('该球员已在扣费名单中')
    return
  }
  settlementForm.charges.push({ userId: player.id, amount: '' })
}

const removeSettlementCustomPlayer = (userId: number) => {
  settlementForm.charges = settlementForm.charges.filter((item) => item.userId !== userId)
}

const fetchActivity = async () => {
  const res = await getActivity(activityId.value)
  activity.value = res
}

const fetchSettlementSummary = async () => {
  settlementLoading.value = true
  settlementError.value = ''
  try {
    const res = await getActivitySettlement(activityId.value)
    settlementSummary.value = res
    patchSettlementFormFromSummary(settlementForm, res)
    syncSettlementCharges()
  } catch (e: unknown) {
    settlementError.value = (e as Error).message || '结算信息加载失败'
  } finally {
    settlementLoading.value = false
  }
}

const fetchRegistrations = async () => {
  regLoading.value = true
  try {
    const res = await listRegistrations(activityId.value, {
      page: regPage.value,
      page_size: regPageSize.value,
      stand: regFilter.value,
    })
    regItems.value = res.items
    regTotal.value = res.total
    regCounts.value = res.counts
    regPage.value = res.page
    selectedRegIds.value = []
    syncSettlementCharges()
    const maxPage = Math.max(1, Math.ceil(res.total / res.page_size))
    if (res.items.length === 0 && res.total > 0 && res.page > maxPage) {
      regPage.value = maxPage
      await fetchRegistrations()
      return
    }
  } finally {
    regLoading.value = false
  }
}

const fetchAll = async () => {
  loading.value = true
  loadError.value = ''
  try {
    await Promise.all([fetchActivity(), fetchRegistrations(), fetchSettlementSummary()])
  } catch (e: unknown) {
    loadError.value = (e as Error).message || '加载失败'
  } finally {
    loading.value = false
  }
}

// ── 更改报名状态 ──
const changeRegStatus = async (userId: number, stand: number) => {
  try {
    await adminRegister(activityId.value, userId, stand)
    await fetchRegistrations()
  } catch (e: unknown) {
    toast.error((e as Error).message || '操作失败')
  }
}

// ── 编辑活动 ──
const editDialogRef = ref<InstanceType<typeof ActivityEditDialog>>()
const editLocationPickerOpen = ref(false)
const editing = ref(false)
const editError = ref('')
const editForm = reactive({
  name: '',
  location: '',
  location_latitude: null as number | null,
  location_longitude: null as number | null,
  opposing: '',
  holding_date: '',
  start_time: '',
  end_time: '',
  description: '',
  players_per_team: null as number | null,
  match_format: '' as '' | `${MatchFormatOption}`,
  status: 0,
})

const onEditMatchFormatChange = () => {
  editForm.players_per_team = editForm.match_format
    ? playersPerTeamFromMatchFormat(Number(editForm.match_format) as MatchFormatOption)
    : null
}

const clearEditLocationCoordinates = () => {
  editForm.location_latitude = null
  editForm.location_longitude = null
}

const openEditModal = () => {
  if (!activity.value) return
  const a = activity.value
  Object.assign(editForm, {
    name: a.name,
    location: a.location,
    location_latitude: a.location_latitude,
    location_longitude: a.location_longitude,
    opposing: a.opposing || '',
    holding_date: toLocalDateTimeInput(a.holding_date),
    start_time: toLocalDateTimeInput(a.start_time),
    end_time: toLocalDateTimeInput(a.end_time),
    description: a.description || '',
    players_per_team: a.players_per_team ?? null,
    match_format: inferMatchFormat(a.players_per_team),
    status: a.status,
  })
  editError.value = ''
  editDialogRef.value?.showModal()
}

const openEditLocationModal = () => {
  editLocationPickerOpen.value = true
}

const applyEditSelectedLocation = (selection: AppliedLocationSelection) => {
  editForm.location = selection.title
  editForm.location_latitude = selection.locationLatitude
  editForm.location_longitude = selection.locationLongitude
  editLocationPickerOpen.value = false
}

const handleEdit = async () => {
  editing.value = true
  editError.value = ''
  try {
    await updateActivity(activityId.value, {
      name: editForm.name || undefined,
      location: editForm.location || undefined,
      location_latitude: editForm.location_latitude,
      location_longitude: editForm.location_longitude,
      opposing: editForm.opposing || null,
      holding_date: editForm.holding_date ? editForm.holding_date + ':00' : undefined,
      start_time: editForm.start_time ? editForm.start_time + ':00' : undefined,
      end_time: editForm.end_time ? editForm.end_time + ':00' : undefined,
      description: editForm.description || null,
      players_per_team: editForm.players_per_team ?? null,
    })
    if (activity.value && editForm.status !== activity.value.status) {
      await updateActivityStatus(activityId.value, editForm.status)
    }
    await fetchAll()
    editDialogRef.value?.close()
  } catch (e: unknown) {
    editError.value = (e as Error).message || '保存失败'
  } finally {
    editing.value = false
  }
}

// ── 手动报名 ──
const manualRegistrationDialogRef = ref<InstanceType<typeof ActivityManualRegistrationDialog>>()
const regSearchKw = ref('')
const regSearchResults = ref<Player[]>([])
const regSearching = ref(false)
const regTarget = ref<Player | null>(null)
const regStand = ref(1)
const regError = ref('')
const registering = ref(false)
let regSearchTimer: ReturnType<typeof setTimeout>

const onRegSearch = () => {
  clearTimeout(regSearchTimer)
  if (!regSearchKw.value.trim()) {
    regSearchResults.value = []
    return
  }
  regSearchTimer = setTimeout(async () => {
    regSearching.value = true
    try {
      const res = await listPlayers({ keyword: regSearchKw.value.trim(), page: 1, page_size: 20 })
      regSearchResults.value = res.items
    } catch {
      regSearchResults.value = []
    } finally {
      regSearching.value = false
    }
  }, 300)
}

const openRegisterModal = () => {
  regSearchKw.value = ''
  regSearchResults.value = []
  regTarget.value = null
  regStand.value = 1
  regError.value = ''
  manualRegistrationDialogRef.value?.showModal()
}

const handleRegister = async () => {
  if (!regTarget.value) return
  registering.value = true
  regError.value = ''
  try {
    await adminRegister(activityId.value, regTarget.value.id, regStand.value)
    await fetchRegistrations()
    manualRegistrationDialogRef.value?.close()
  } catch (e: unknown) {
    regError.value = (e as Error).message || '报名失败'
  } finally {
    registering.value = false
  }
}

// ── 取消报名 ──
const registrationDialogsRef = ref<InstanceType<typeof ActivityRegistrationDialogs>>()
const cancelTarget = ref<RegistrationWithInfo | null>(null)
const cancelling = ref(false)

const confirmCancel = (reg: RegistrationWithInfo) => {
  cancelTarget.value = reg
  registrationDialogsRef.value?.showCancel()
}

const handleCancel = async () => {
  if (!cancelTarget.value) return
  cancelling.value = true
  try {
    await cancelRegistration(activityId.value, cancelTarget.value.user_id)
    await fetchRegistrations()
    registrationDialogsRef.value?.closeCancel()
  } catch (e: unknown) {
    toast.error((e as Error).message || '操作失败')
  } finally {
    cancelling.value = false
  }
}

// ── 批量修改报名状态 ──
const batchStandValue = ref<number>(1)
const batchStandSubmitting = ref(false)

const openBatchStandModal = () => {
  batchStandValue.value = 1
  batchStandSubmitting.value = false
  registrationDialogsRef.value?.showBatchStand()
}

const handleBatchUpdateStand = async () => {
  if (selectedRegIds.value.length === 0) return
  batchStandSubmitting.value = true
  try {
    await batchUpdateStand(activityId.value, selectedRegIds.value, batchStandValue.value)
    await fetchRegistrations()
    registrationDialogsRef.value?.closeBatchStand()
  } catch (e: unknown) {
    toast.error((e as Error).message || '批量修改失败')
  } finally {
    batchStandSubmitting.value = false
  }
}

const handleSettlement = async () => {
  if (activity.value?.status !== 2) return
  syncSettlementCharges()
  const validationMessage = validateSettlementForm(settlementForm, regCounts.value.attending)
  if (validationMessage) {
    settlementError.value = validationMessage
    return
  }

  settlementSubmitting.value = true
  settlementError.value = ''
  try {
    const items =
      settlementForm.participantScope === 'custom_users' || settlementForm.mode === 'manual'
        ? settlementForm.charges.map((item) => ({
            user_id: item.userId,
            amount: settlementForm.mode === 'manual' ? item.amount : undefined,
          }))
        : []
    const res = await settleActivityExpense(activityId.value, {
      total_amount: settlementForm.totalAmount,
      mode: settlementForm.mode,
      participant_scope: settlementForm.participantScope,
      items,
      description: settlementForm.description.trim() || undefined,
    })
    settlementSummary.value = res
    patchSettlementFormFromSummary(settlementForm, res)
    syncSettlementCharges()
    toast.success(res.current_batch_no ? `当前有效结算批次已更新为第 ${res.current_batch_no} 批` : '本场比赛费用已完成结算')
  } catch (e: unknown) {
    settlementError.value = (e as Error).message || '结算失败'
  } finally {
    settlementSubmitting.value = false
  }
}

onMounted(fetchAll)
</script>
