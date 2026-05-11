<template>
  <div class="flex flex-col gap-6">
    <!-- 标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold">球队管理</h2>
        <p class="text-sm text-base-content/60 mt-0.5">创建和管理球队，设置队长、领队及球员成员</p>
      </div>
      <button class="btn btn-primary gap-2" @click="openCreateModal">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
        创建球队
      </button>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="stat bg-base-100 border border-base-300 rounded-xl shadow-sm py-4 px-5">
        <div class="stat-title text-xs">球队总数</div>
        <div class="stat-value text-2xl">{{ teams.length }}</div>
      </div>
      <div class="stat bg-base-100 border border-base-300 rounded-xl shadow-sm py-4 px-5">
        <div class="stat-title text-xs">正常球队</div>
        <div class="stat-value text-2xl text-success">
          {{ teams.filter((t) => t.status === 1).length }}
        </div>
      </div>
      <div class="stat bg-base-100 border border-base-300 rounded-xl shadow-sm py-4 px-5">
        <div class="stat-title text-xs">总队员数</div>
        <div class="stat-value text-2xl text-info">
          {{ teams.reduce((s, t) => s + t.member_count, 0) }}
        </div>
      </div>
      <div class="stat bg-base-100 border border-base-300 rounded-xl shadow-sm py-4 px-5">
        <div class="stat-title text-xs">无队长球队</div>
        <div class="stat-value text-2xl text-warning">
          {{ teams.filter((t) => !t.captain_id).length }}
        </div>
      </div>
    </div>

    <!-- 球队卡片列表 -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="card-body p-5">
          <div class="flex items-start gap-3">
            <div class="skeleton h-12 w-12 rounded-xl"></div>
            <div class="flex-1 space-y-2">
              <div class="skeleton h-5 w-24"></div>
              <div class="skeleton h-4 w-full"></div>
            </div>
          </div>
          <div class="flex gap-4 mt-3 pt-3 border-t border-base-200">
            <div class="skeleton h-4 w-16"></div>
            <div class="skeleton h-4 w-16"></div>
          </div>
          <div class="flex gap-2 mt-3">
            <div class="skeleton h-8 flex-1"></div>
            <div class="skeleton h-8 w-8 btn-square"></div>
            <div class="skeleton h-8 w-8 btn-square"></div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="loadError" class="alert alert-error">
      <span>{{ loadError }}</span>
      <button class="btn btn-sm btn-ghost" @click="fetchTeams">重试</button>
    </div>

    <div v-else-if="teams.length === 0" class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body items-center py-16">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-12 w-12 text-base-content/20"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"
          />
        </svg>
        <p class="text-base-content/40 mt-2">暂无球队，点击右上角创建第一支球队</p>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="team in teams"
        :key="team.id"
        class="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
        @click="goToDetail(team.id)"
      >
        <div class="card-body p-5">
          <!-- 头部：logo + 名称 + 状态 -->
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0">
              <div v-if="team.logo_url" class="avatar">
                <div class="w-12 rounded-xl">
                  <img :src="team.logo_url" :alt="team.name" />
                </div>
              </div>
              <div
                v-else
                class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-7 w-7 text-primary"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
                  />
                </svg>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-base leading-snug truncate">{{ team.name }}</h3>
                <span
                  class="badge badge-sm flex-shrink-0"
                  :class="team.status === 1 ? 'badge-success' : 'badge-error'"
                >
                  {{ team.status === 1 ? '正常' : '解散' }}
                </span>
              </div>
              <p class="text-sm text-base-content/50 mt-0.5 line-clamp-2">
                {{ team.description || '暂无简介' }}
              </p>
            </div>
          </div>

          <!-- 统计 -->
          <div class="flex items-center gap-4 mt-3 pt-3 border-t border-base-200">
            <div class="flex items-center gap-1.5 text-sm text-base-content/60">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"
                />
              </svg>
              <span
                ><strong class="text-base-content">{{ team.member_count }}</strong> 名队员</span
              >
            </div>
            <div
              class="flex items-center gap-1.5 text-sm"
              :class="team.captain_id ? 'text-base-content/60' : 'text-warning'"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                />
              </svg>
              <span>{{ team.captain_id ? '已设队长' : '未设队长' }}</span>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex gap-2 mt-3">
            <button class="btn btn-sm btn-outline flex-1" @click.stop="goToDetail(team.id)">
              管理成员
            </button>
            <button
              class="btn btn-sm btn-ghost btn-square"
              title="编辑球队"
              @click.stop="openEditModal(team)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                />
              </svg>
            </button>
            <button
              class="btn btn-sm btn-ghost btn-square text-error"
              title="删除球队"
              @click.stop="confirmDelete(team)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 创建球队弹窗 -->
  <dialog ref="createModalRef" class="modal">
    <div class="modal-box max-w-lg">
      <h3 class="text-lg font-bold mb-1">创建球队</h3>
      <p class="text-sm text-base-content/50 mb-5">填写球队基本信息</p>

      <div v-if="createError" role="alert" class="alert alert-error py-2.5 mb-4 text-sm">
        {{ createError }}
      </div>

      <form @submit.prevent="handleCreate" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">球队名称 <span class="text-error">*</span></span>
          <input
            v-model="createForm.name"
            type="text"
            placeholder="请输入球队名称"
            required
            class="input input-bordered border-2 h-11"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">简介</span>
          <textarea
            v-model="createForm.description"
            placeholder="请输入球队简介（可选）"
            rows="3"
            class="textarea textarea-bordered border-2 resize-none"
          ></textarea>
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">队徽 URL</span>
          <input
            v-model="createForm.logo_url"
            type="url"
            placeholder="https://..."
            class="input input-bordered border-2 h-11"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">加入密码</span>
          <input
            v-model="createForm.join_password"
            type="text"
            placeholder="留空则无密码限制"
            class="input input-bordered border-2 h-11"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">初始队长 ID</span>
          <input
            v-model.number="createForm.captain_id"
            type="number"
            placeholder="球员 ID（可选，填写后自动加入球队）"
            class="input input-bordered border-2 h-11"
          />
        </label>

        <div class="modal-action mt-2">
          <button type="button" class="btn btn-ghost" @click="closeCreateModal">取消</button>
          <button type="submit" class="btn btn-primary" :disabled="creating">
            <span v-if="creating" class="loading loading-spinner loading-sm"></span>
            {{ creating ? '创建中...' : '确认创建' }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <!-- 编辑球队弹窗 -->
  <dialog ref="editModalRef" class="modal">
    <div class="modal-box max-w-lg">
      <h3 class="text-lg font-bold mb-1">编辑球队</h3>
      <p class="text-sm text-base-content/50 mb-5">修改 {{ editingTeam?.name }} 的信息</p>

      <div v-if="editError" role="alert" class="alert alert-error py-2.5 mb-4 text-sm">
        {{ editError }}
      </div>

      <form @submit.prevent="handleEdit" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">球队名称</span>
          <input v-model="editForm.name" type="text" class="input input-bordered border-2 h-11" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">简介</span>
          <textarea
            v-model="editForm.description"
            rows="3"
            class="textarea textarea-bordered border-2 resize-none"
          ></textarea>
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">队徽 URL</span>
          <input
            v-model="editForm.logo_url"
            type="url"
            placeholder="https://..."
            class="input input-bordered border-2 h-11"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">状态</span>
          <select v-model.number="editForm.status" class="select select-bordered border-2 h-11">
            <option :value="1">正常</option>
            <option :value="0">解散</option>
          </select>
        </label>
        <div class="modal-action mt-2">
          <button type="button" class="btn btn-ghost" @click="closeEditModal">取消</button>
          <button type="submit" class="btn btn-primary" :disabled="editing">
            <span v-if="editing" class="loading loading-spinner loading-sm"></span>
            {{ editing ? '保存中...' : '保存修改' }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <!-- 删除确认弹窗 -->
  <dialog ref="deleteModalRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">确认删除</h3>
      <p class="py-4 text-base-content/70">
        确定要删除球队
        <strong>{{ deletingTeam?.name }}</strong>
        吗？该球队的所有成员关系也将被清除，此操作不可撤销。
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="closeDeleteModal">取消</button>
        <button class="btn btn-error" :disabled="deleting" @click="handleDelete">
          <span v-if="deleting" class="loading loading-spinner loading-sm"></span>
          {{ deleting ? '删除中...' : '确认删除' }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '@/utils/toast'
import {
  adminListTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  type TeamSummary,
} from '@/services/team'

const router = useRouter()

const teams = ref<TeamSummary[]>([])
const loading = ref(false)
const loadError = ref('')

// 创建
const createModalRef = ref<HTMLDialogElement>()
const creating = ref(false)
const createError = ref('')
const createForm = reactive({
  name: '',
  description: '',
  logo_url: '',
  join_password: '',
  captain_id: undefined as number | undefined,
})

// 编辑
const editModalRef = ref<HTMLDialogElement>()
const editing = ref(false)
const editError = ref('')
const editingTeam = ref<TeamSummary | null>(null)
const editForm = reactive({
  name: '',
  description: '',
  logo_url: '',
  status: 1,
})

// 删除
const deleteModalRef = ref<HTMLDialogElement>()
const deleting = ref(false)
const deletingTeam = ref<TeamSummary | null>(null)

const fetchTeams = async () => {
  loading.value = true
  loadError.value = ''
  try {
    teams.value = await adminListTeams()
  } catch (e: unknown) {
    loadError.value = (e as Error).message || '加载失败'
  } finally {
    loading.value = false
  }
}

const goToDetail = (teamId: string) => router.push(`/teams/${teamId}`)

const openCreateModal = () => {
  createError.value = ''
  createForm.name = ''
  createForm.description = ''
  createForm.logo_url = ''
  createForm.join_password = ''
  createForm.captain_id = undefined
  createModalRef.value?.showModal()
}
const closeCreateModal = () => createModalRef.value?.close()

const handleCreate = async () => {
  creating.value = true
  createError.value = ''
  try {
    const team = await createTeam({
      name: createForm.name,
      description: createForm.description || undefined,
      logo_url: createForm.logo_url || undefined,
      join_password: createForm.join_password || undefined,
      captain_id: createForm.captain_id,
    })
    closeCreateModal()
    // 刷新列表
    await fetchTeams()
    router.push(`/teams/${team.id}`)
  } catch (e: unknown) {
    createError.value = (e as Error).message || '创建失败'
  } finally {
    creating.value = false
  }
}

const openEditModal = (team: TeamSummary) => {
  editingTeam.value = team
  editForm.name = team.name
  editForm.description = team.description || ''
  editForm.logo_url = team.logo_url || ''
  editForm.status = team.status
  editError.value = ''
  editModalRef.value?.showModal()
}
const closeEditModal = () => editModalRef.value?.close()

const handleEdit = async () => {
  if (!editingTeam.value) return
  editing.value = true
  editError.value = ''
  try {
    await updateTeam(editingTeam.value.id, {
      name: editForm.name || undefined,
      description: editForm.description || null,
      logo_url: editForm.logo_url || null,
      status: editForm.status,
    })
    // 更新本地数据
    const idx = teams.value.findIndex((t) => t.id === editingTeam.value!.id)
    if (idx >= 0) {
      teams.value[idx] = {
        ...teams.value[idx]!,
        name: editForm.name,
        description: editForm.description || null,
        logo_url: editForm.logo_url || null,
        status: editForm.status,
      }
    }
    closeEditModal()
  } catch (e: unknown) {
    editError.value = (e as Error).message || '保存失败'
  } finally {
    editing.value = false
  }
}

const confirmDelete = (team: TeamSummary) => {
  deletingTeam.value = team
  deleteModalRef.value?.showModal()
}
const closeDeleteModal = () => {
  deleteModalRef.value?.close()
  deletingTeam.value = null
}

const handleDelete = async () => {
  if (!deletingTeam.value) return
  deleting.value = true
  try {
    await deleteTeam(deletingTeam.value.id)
    teams.value = teams.value.filter((t) => t.id !== deletingTeam.value!.id)
    closeDeleteModal()
  } catch (e: unknown) {
    toast.error((e as Error).message || '删除失败')
  } finally {
    deleting.value = false
  }
}

onMounted(fetchTeams)
</script>
