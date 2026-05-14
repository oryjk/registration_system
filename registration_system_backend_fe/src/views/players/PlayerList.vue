<template>
  <div class="flex flex-col gap-6">
    <PlayerFilterBar
      :filters="filters"
      :total="total"
      :current-page="currentPage"
      :total-pages="totalPages"
      :page-numbers="pageNumbers"
      :loading="loading"
      :load-error="loadError"
      @create="openCreateModal"
      @search="handleSearch"
      @reset="handleReset"
      @page="changePage"
    />

    <PlayerTable
      :players="players"
      :loading="loading"
      :load-error="loadError"
      :show-initial-loading="showInitialLoading"
      :show-overlay-loading="showOverlayLoading"
      :selected-player-ids="selectedPlayerIds"
      :all-players-selected="allPlayersSelected"
      :sort-by="sortBy"
      :sort-order="sortOrder"
      @retry="fetchPlayers"
      @clear-selection="selectedPlayerIds = []"
      @batch-delete="openBatchDeleteModal"
      @toggle-select-all="toggleSelectAllPlayers"
      @toggle-player="toggleSelectPlayer"
      @sort="toggleSort"
      @edit="openEditModal"
      @freeze="openFreezeModal"
      @unfreeze="confirmUnfreeze"
      @delete="confirmDelete"
    />
  </div>

  <PlayerEditDialog
    ref="createDialogRef"
    v-model:form="createForm"
    mode="create"
    :submitting="creating"
    :error="createError"
    @submit="handleCreate"
  />

  <PlayerEditDialog
    ref="editDialogRef"
    v-model:form="editForm"
    mode="edit"
    :submitting="editing"
    :error="editError"
    @submit="handleEdit"
  />

  <PlayerFreezeDialog
    ref="playerFreezeDialogRef"
    :freeze-target="freezeTarget"
    :freeze-form="freezeForm"
    :freeze-error="freezeError"
    :freezing="freezing"
    :unfreeze-target="unfreezeTarget"
    :unfreezing="unfreezing"
    :deleting-player="deletingPlayer"
    :deleting="deleting"
    :selected-player-count="selectedPlayerIds.length"
    :batch-deleting="batchDeleting"
    @freeze-submit="handleFreeze"
    @unfreeze-submit="handleUnfreeze"
    @delete-submit="handleDelete"
    @batch-delete-submit="handleBatchDelete"
  />
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import {
  listPlayers,
  createPlayer,
  updatePlayer,
  freezePlayer,
  unfreezePlayer,
  deletePlayer,
  type Player,
} from '@/services/player'
import { toast } from '@/utils/toast'
import {
  buildPageNumbers,
  createPlayerFilters,
  formatPlayerDate,
  PLAYER_PAGE_SIZE,
  roleLabel,
  type PlayerFilters,
} from './player-list.model'
import PlayerFilterBar from './PlayerFilterBar.vue'
import PlayerEditDialog from './PlayerEditDialog.vue'
import PlayerFreezeDialog from './PlayerFreezeDialog.vue'
import PlayerTable from './PlayerTable.vue'

const players = ref<Player[]>([])
const loading = ref(false)
const loadError = ref('')
const total = ref(0)
const currentPage = ref(1)

const filters = reactive<PlayerFilters>(createPlayerFilters())
const sortBy = ref<string | undefined>(undefined)
const sortOrder = ref<string | undefined>(undefined)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PLAYER_PAGE_SIZE)))
const showInitialLoading = computed(() => loading.value && players.value.length === 0)
const showOverlayLoading = computed(() => loading.value && players.value.length > 0)
const pageNumbers = computed(() => buildPageNumbers(currentPage.value, totalPages.value))

const fetchPlayers = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await listPlayers({
      keyword: filters.keyword || undefined,
      status: filters.status,
      has_team: filters.has_team,
      page: currentPage.value,
      page_size: PLAYER_PAGE_SIZE,
      sort_by: sortBy.value,
      sort_order: sortOrder.value,
    })
    players.value = res.items
    total.value = res.total
  } catch (e: unknown) {
    loadError.value = (e as Error).message || '加载失败'
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchPlayers()
}
const handleReset = () => {
  Object.assign(filters, createPlayerFilters())
  sortBy.value = undefined
  sortOrder.value = undefined
  currentPage.value = 1
  fetchPlayers()
}

const toggleSort = (field: string) => {
  if (sortBy.value === field) {
    if (sortOrder.value === 'desc') {
      sortOrder.value = 'asc'
    } else if (sortOrder.value === 'asc') {
      sortBy.value = undefined
      sortOrder.value = undefined
    } else {
      sortOrder.value = 'desc'
    }
  } else {
    sortBy.value = field
    sortOrder.value = 'desc'
  }
  currentPage.value = 1
  fetchPlayers()
}
const changePage = (page: number) => {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  fetchPlayers()
}

// ── 新建 ──
const createDialogRef = ref<InstanceType<typeof PlayerEditDialog>>()
const creating = ref(false)
const createError = ref('')
const createForm = reactive({ real_name: '', nickname: '', phone_number: '' })

const openCreateModal = () => {
  Object.assign(createForm, { real_name: '', nickname: '', phone_number: '' })
  createError.value = ''
  createDialogRef.value?.showModal()
}

const handleCreate = async () => {
  creating.value = true
  createError.value = ''
  try {
    await createPlayer({
      real_name: createForm.real_name,
      nickname: createForm.nickname || undefined,
      phone_number: createForm.phone_number || undefined,
    })
    await fetchPlayers()
    createDialogRef.value?.close()
  } catch (e: unknown) {
    createError.value = (e as Error).message || '创建失败'
  } finally {
    creating.value = false
  }
}

// ── 编辑 ──
const editDialogRef = ref<InstanceType<typeof PlayerEditDialog>>()
const editing = ref(false)
const editError = ref('')
const editingPlayer = ref<Player | null>(null)
const editForm = reactive({ real_name: '', nickname: '', phone_number: '' })

const openEditModal = (player: Player) => {
  editingPlayer.value = player
  Object.assign(editForm, {
    real_name: player.real_name,
    nickname: player.nickname,
    phone_number: player.phone_number,
  })
  editError.value = ''
  editDialogRef.value?.showModal()
}

const handleEdit = async () => {
  if (!editingPlayer.value) return
  editing.value = true
  editError.value = ''
  try {
    await updatePlayer(editingPlayer.value.id, {
      real_name: editForm.real_name || undefined,
      nickname: editForm.nickname || undefined,
      phone_number: editForm.phone_number || undefined,
    })
    await fetchPlayers()
    editDialogRef.value?.close()
  } catch (e: unknown) {
    editError.value = (e as Error).message || '保存失败'
  } finally {
    editing.value = false
  }
}

// ── 冻结 ──
const playerFreezeDialogRef = ref<InstanceType<typeof PlayerFreezeDialog>>()
const freezing = ref(false)
const freezeError = ref('')
const freezeTarget = ref<Player | null>(null)
const freezeForm = reactive({ start: '', end: '' })

const openFreezeModal = (player: Player) => {
  freezeTarget.value = player
  const now = new Date()
  freezeForm.start = now.toISOString().slice(0, 16)
  freezeForm.end = ''
  freezeError.value = ''
  playerFreezeDialogRef.value?.showFreeze()
}

const handleFreeze = async () => {
  if (!freezeTarget.value || !freezeForm.start) return
  freezing.value = true
  freezeError.value = ''
  try {
    await freezePlayer(freezeTarget.value.id, {
      freeze_start_time: freezeForm.start + ':00',
      freeze_end_time: freezeForm.end ? freezeForm.end + ':00' : undefined,
    })
    await fetchPlayers()
    playerFreezeDialogRef.value?.closeFreeze()
  } catch (e: unknown) {
    freezeError.value = (e as Error).message || '冻结失败'
  } finally {
    freezing.value = false
  }
}

// ── 解冻 ──
const unfreezing = ref(false)
const unfreezeTarget = ref<Player | null>(null)

const confirmUnfreeze = (player: Player) => {
  unfreezeTarget.value = player
  playerFreezeDialogRef.value?.showUnfreeze()
}

const handleUnfreeze = async () => {
  if (!unfreezeTarget.value) return
  unfreezing.value = true
  try {
    await unfreezePlayer(unfreezeTarget.value.id)
    await fetchPlayers()
    playerFreezeDialogRef.value?.closeUnfreeze()
  } catch (e: unknown) {
    toast.error((e as Error).message || '解冻失败')
  } finally {
    unfreezing.value = false
  }
}

// ── 删除 ──
const deleting = ref(false)
const deletingPlayer = ref<Player | null>(null)

const confirmDelete = (player: Player) => {
  deletingPlayer.value = player
  playerFreezeDialogRef.value?.showDelete()
}

const handleDelete = async () => {
  if (!deletingPlayer.value) return
  deleting.value = true
  try {
    await deletePlayer(deletingPlayer.value.id)
    await fetchPlayers()
    playerFreezeDialogRef.value?.closeDelete()
  } catch (e: unknown) {
    toast.error((e as Error).message || '删除失败')
  } finally {
    deleting.value = false
  }
}

// ── 批量删除 ──
const selectedPlayerIds = ref<number[]>([])

const toggleSelectPlayer = (id: number) => {
  const idx = selectedPlayerIds.value.indexOf(id)
  if (idx === -1) selectedPlayerIds.value.push(id)
  else selectedPlayerIds.value.splice(idx, 1)
}

const allPlayersSelected = computed(() => {
  if (players.value.length === 0) return false
  return players.value.every((p) => selectedPlayerIds.value.includes(p.id))
})

const toggleSelectAllPlayers = () => {
  if (allPlayersSelected.value) {
    players.value.forEach((p) => {
      const idx = selectedPlayerIds.value.indexOf(p.id)
      if (idx !== -1) selectedPlayerIds.value.splice(idx, 1)
    })
  } else {
    players.value.forEach((p) => {
      if (!selectedPlayerIds.value.includes(p.id)) selectedPlayerIds.value.push(p.id)
    })
  }
}

const batchDeleting = ref(false)

const openBatchDeleteModal = () => {
  playerFreezeDialogRef.value?.showBatchDelete()
}

const handleBatchDelete = async () => {
  if (selectedPlayerIds.value.length === 0) return
  batchDeleting.value = true
  let successCount = 0
  const errors: string[] = []

  for (const id of selectedPlayerIds.value) {
    try {
      await deletePlayer(id)
      successCount++
    } catch (e: unknown) {
      errors.push(`ID ${id}: ${(e as Error).message}`)
    }
  }

  await fetchPlayers()
  selectedPlayerIds.value = []
  playerFreezeDialogRef.value?.closeBatchDelete()
  batchDeleting.value = false

  if (errors.length > 0) {
    toast.warning(`${successCount} 人删除成功，${errors.length} 人失败：${errors.join('；')}`)
  }
}

onMounted(fetchPlayers)
</script>
