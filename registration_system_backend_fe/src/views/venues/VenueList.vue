<template>
  <div class="flex flex-col gap-6">
    <section class="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 class="text-xl font-semibold">场馆管理</h2>
          <p class="mt-1 text-sm text-base-content/60">
            管理独立场馆账号，或把已有小程序用户绑定为场馆。冻结后将无法登录和发布比赛/散人报名。
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-outline" @click="openBindDialog">绑定已有小程序用户</button>
          <button class="btn btn-primary" @click="openCreateDialog">创建独立场馆账号</button>
        </div>
      </div>

      <div class="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
        <label class="form-control">
          <span class="label-text mb-1 text-sm">搜索昵称 / 真实姓名 / 手机号</span>
          <input
            v-model.trim="filters.keyword"
            class="input input-bordered"
            placeholder="例如：赛悦、老王、138..."
            @keyup.enter="fetchVenues"
          />
        </label>
        <label class="form-control">
          <span class="label-text mb-1 text-sm">状态</span>
          <select v-model.number="filters.status" class="select select-bordered">
            <option :value="-1">全部</option>
            <option :value="1">活跃</option>
            <option :value="0">冻结</option>
          </select>
        </label>
        <div class="flex items-end gap-2">
          <button class="btn btn-primary" :disabled="loading" @click="fetchVenues">查询</button>
          <button class="btn btn-ghost" :disabled="loading" @click="resetFilters">重置</button>
        </div>
      </div>
    </section>

    <section class="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>场馆</th>
              <th>联系方式</th>
              <th>身份来源</th>
              <th>状态</th>
              <th class="w-[320px] text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="venue in venues" :key="venue.id">
              <td>
                <div class="flex items-center gap-3">
                  <div class="avatar">
                    <div class="h-10 w-10 rounded-full bg-base-300">
                      <img v-if="venue.avatar_url" :src="venue.avatar_url" :alt="venue.nickname" />
                      <div v-else class="flex h-full items-center justify-center text-sm font-semibold">
                        {{ (venue.real_name || venue.nickname || '场').charAt(0) }}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div class="font-medium">{{ venue.real_name || venue.nickname || '未命名场馆' }}</div>
                    <div class="text-xs text-base-content/55">@{{ venue.nickname || '未设置昵称' }}</div>
                    <div class="text-xs text-base-content/45">ID: {{ venue.id }}</div>
                  </div>
                </div>
              </td>
              <td>
                <div class="text-sm">{{ venue.phone_number || '-' }}</div>
              </td>
              <td>
                <span class="badge badge-outline">
                  {{ isStandaloneVenue(venue) ? '独立账号' : '小程序用户绑定' }}
                </span>
              </td>
              <td>
                <span class="badge" :class="venue.status === 1 ? 'badge-success badge-outline' : 'badge-warning'">
                  {{ venue.status === 1 ? '活跃' : '冻结' }}
                </span>
              </td>
              <td class="w-[320px]">
                <div class="ml-auto grid w-[304px] grid-cols-4 gap-2">
                  <button class="btn btn-ghost btn-sm min-w-0 px-0" @click="openEditDialog(venue)">编辑</button>
                  <button
                    v-if="isStandaloneVenue(venue)"
                    class="btn btn-ghost btn-sm min-w-0 px-0"
                    @click="openPasswordDialog(venue)"
                  >
                    改密
                  </button>
                  <div v-else aria-hidden="true"></div>
                  <button
                    v-if="venue.status === 1"
                    class="btn btn-warning btn-sm min-w-0 px-0"
                    @click="openFreezeDialog(venue)"
                  >
                    冻结
                  </button>
                  <button
                    v-else
                    class="btn btn-success btn-sm min-w-0 px-0"
                    :disabled="acting"
                    @click="handleUnfreeze(venue)"
                  >
                    解冻
                  </button>
                  <button class="btn btn-error btn-sm min-w-0 px-0" @click="openRemoveDialog(venue)">
                    {{ isStandaloneVenue(venue) ? '删除' : '移除场馆' }}
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!loading && venues.length === 0">
              <td colspan="5" class="py-12 text-center text-base-content/55">暂无场馆数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <dialog ref="createDialogRef" class="modal">
    <div class="modal-box max-w-2xl">
      <h3 class="text-lg font-semibold">创建独立场馆账号</h3>
      <div v-if="createError" class="alert alert-error mt-4 text-sm">{{ createError }}</div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <input v-model.trim="createForm.real_name" class="input input-bordered" placeholder="场馆名称 / 真实姓名" />
        <input v-model.trim="createForm.nickname" class="input input-bordered" placeholder="昵称（可选）" />
        <input v-model.trim="createForm.username" class="input input-bordered" placeholder="登录账号" />
        <input v-model.trim="createForm.password" type="password" class="input input-bordered" placeholder="登录密码" />
        <input v-model.trim="createForm.phone_number" class="input input-bordered md:col-span-2" placeholder="手机号（可选）" />
      </div>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="createDialogRef?.close()">取消</button>
        <button class="btn btn-primary" :disabled="acting" @click="handleCreateVenue">创建</button>
      </div>
    </div>
  </dialog>

  <dialog ref="bindDialogRef" class="modal">
    <div class="modal-box max-w-2xl">
      <h3 class="text-lg font-semibold">绑定已有小程序用户为场馆</h3>
      <div class="mt-4 flex gap-2">
        <input
          v-model.trim="bindKeyword"
          class="input input-bordered flex-1"
          placeholder="输入昵称或真实姓名搜索"
          @keyup.enter="handleSearchCandidates"
        />
        <button class="btn btn-primary" :disabled="acting" @click="handleSearchCandidates">搜索</button>
      </div>
      <div class="mt-4 max-h-80 overflow-y-auto rounded-xl border border-base-300">
        <button
          v-for="item in bindCandidates"
          :key="item.id"
          class="flex w-full items-center justify-between gap-3 border-b border-base-200 px-4 py-3 text-left last:border-b-0 hover:bg-base-200/60"
          @click="handleBindVenue(item.id)"
        >
          <div>
            <div class="font-medium">{{ item.real_name || item.nickname || `用户 ${item.id}` }}</div>
            <div class="text-xs text-base-content/55">@{{ item.nickname || '未设置昵称' }} · ID {{ item.id }}</div>
          </div>
          <span class="badge" :class="item.is_venue ? 'badge-primary badge-outline' : 'badge-ghost'">
            {{ item.is_venue ? '已是场馆' : '设为场馆' }}
          </span>
        </button>
        <div v-if="bindCandidates.length === 0" class="px-4 py-10 text-center text-sm text-base-content/50">
          输入昵称后搜索可绑定用户
        </div>
      </div>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="bindDialogRef?.close()">关闭</button>
      </div>
    </div>
  </dialog>

  <dialog ref="editDialogRef" class="modal">
    <div class="modal-box max-w-xl">
      <h3 class="text-lg font-semibold">编辑场馆信息</h3>
      <div v-if="editError" class="alert alert-error mt-4 text-sm">{{ editError }}</div>
      <div class="mt-4 grid gap-4">
        <input v-model.trim="editForm.real_name" class="input input-bordered" placeholder="场馆名称 / 真实姓名" />
        <input v-model.trim="editForm.nickname" class="input input-bordered" placeholder="昵称" />
        <input v-model.trim="editForm.phone_number" class="input input-bordered" placeholder="手机号" />
      </div>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="editDialogRef?.close()">取消</button>
        <button class="btn btn-primary" :disabled="acting" @click="handleUpdateVenue">保存</button>
      </div>
    </div>
  </dialog>

  <dialog ref="passwordDialogRef" class="modal">
    <div class="modal-box max-w-md">
      <h3 class="text-lg font-semibold">修改场馆账号密码</h3>
      <div v-if="passwordError" class="alert alert-error mt-4 text-sm">{{ passwordError }}</div>
      <input v-model.trim="passwordForm.password" type="password" class="input input-bordered mt-4 w-full" placeholder="请输入新密码" />
      <div class="modal-action">
        <button class="btn btn-ghost" @click="passwordDialogRef?.close()">取消</button>
        <button class="btn btn-primary" :disabled="acting" @click="handleChangePassword">保存</button>
      </div>
    </div>
  </dialog>

  <dialog ref="freezeDialogRef" class="modal">
    <div class="modal-box max-w-md">
      <h3 class="text-lg font-semibold">冻结场馆</h3>
      <div v-if="freezeError" class="alert alert-error mt-4 text-sm">{{ freezeError }}</div>
      <div class="mt-4 grid gap-4">
        <input v-model="freezeForm.start" type="datetime-local" class="input input-bordered" />
        <input v-model="freezeForm.end" type="datetime-local" class="input input-bordered" />
      </div>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="freezeDialogRef?.close()">取消</button>
        <button class="btn btn-warning" :disabled="acting" @click="handleFreezeVenue">确认冻结</button>
      </div>
    </div>
  </dialog>

  <dialog ref="removeDialogRef" class="modal">
    <div class="modal-box max-w-md">
      <h3 class="text-lg font-semibold">{{ removeTarget && isStandaloneVenue(removeTarget) ? '删除独立场馆账号' : '移除场馆身份' }}</h3>
      <p class="mt-3 text-sm text-base-content/70">
        {{ removeTarget && isStandaloneVenue(removeTarget) ? '删除后该独立场馆账号将无法继续登录。' : '移除后该用户仍保留小程序用户身份，只是不再作为场馆。' }}
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="removeDialogRef?.close()">取消</button>
        <button class="btn btn-error" :disabled="acting" @click="handleRemoveVenue">确认</button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  bindUserAsVenue,
  changeVenuePassword,
  createVenueAccount,
  freezeVenue,
  listVenues,
  removeVenue,
  searchMiniUsers,
  unfreezeVenue,
  updateVenue,
  type BindVenueUserOption,
  type Venue,
} from '@/services/venue'
import { toast } from '@/utils/toast'

const venues = ref<Venue[]>([])
const loading = ref(false)
const acting = ref(false)

const filters = reactive({
  keyword: '',
  status: -1,
})

const createDialogRef = ref<HTMLDialogElement>()
const bindDialogRef = ref<HTMLDialogElement>()
const editDialogRef = ref<HTMLDialogElement>()
const passwordDialogRef = ref<HTMLDialogElement>()
const freezeDialogRef = ref<HTMLDialogElement>()
const removeDialogRef = ref<HTMLDialogElement>()

const createForm = reactive({
  real_name: '',
  nickname: '',
  username: '',
  password: '',
  phone_number: '',
})
const createError = ref('')

const bindKeyword = ref('')
const bindCandidates = ref<BindVenueUserOption[]>([])

const editingVenue = ref<Venue | null>(null)
const editForm = reactive({
  real_name: '',
  nickname: '',
  phone_number: '',
})
const editError = ref('')

const passwordTarget = ref<Venue | null>(null)
const passwordForm = reactive({ password: '' })
const passwordError = ref('')

const freezeTarget = ref<Venue | null>(null)
const freezeForm = reactive({ start: '', end: '' })
const freezeError = ref('')

const removeTarget = ref<Venue | null>(null)

const resolvedStatus = computed(() => (filters.status === -1 ? undefined : filters.status))

const fetchVenues = async () => {
  loading.value = true
  try {
    const res = await listVenues({
      keyword: filters.keyword || undefined,
      status: resolvedStatus.value,
      page: 1,
      page_size: 100,
      sort_by: 'latest_login_date',
      sort_order: 'desc',
    })
    venues.value = res.items as Venue[]
  } catch (error) {
    toast.error((error as Error).message || '加载场馆列表失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.keyword = ''
  filters.status = -1
  fetchVenues()
}

const isStandaloneVenue = (venue: Venue) => Boolean(venue.username)

const openCreateDialog = () => {
  Object.assign(createForm, { real_name: '', nickname: '', username: '', password: '', phone_number: '' })
  createError.value = ''
  createDialogRef.value?.showModal()
}

const handleCreateVenue = async () => {
  if (!createForm.real_name || !createForm.username || !createForm.password) {
    createError.value = '场馆名称、登录账号、登录密码不能为空'
    return
  }
  acting.value = true
  createError.value = ''
  try {
    await createVenueAccount({
      real_name: createForm.real_name,
      nickname: createForm.nickname || undefined,
      username: createForm.username,
      password: createForm.password,
      phone_number: createForm.phone_number || undefined,
    })
    createDialogRef.value?.close()
    await fetchVenues()
    toast.success('场馆账号创建成功')
  } catch (error) {
    createError.value = (error as Error).message || '创建场馆账号失败'
  } finally {
    acting.value = false
  }
}

const openBindDialog = () => {
  bindKeyword.value = ''
  bindCandidates.value = []
  bindDialogRef.value?.showModal()
}

const handleSearchCandidates = async () => {
  if (!bindKeyword.value) return
  acting.value = true
  try {
    bindCandidates.value = await searchMiniUsers(bindKeyword.value, 20)
  } catch (error) {
    toast.error((error as Error).message || '搜索用户失败')
  } finally {
    acting.value = false
  }
}

const handleBindVenue = async (userId: number) => {
  acting.value = true
  try {
    await bindUserAsVenue(userId)
    await fetchVenues()
    toast.success('已设置为场馆')
    bindDialogRef.value?.close()
  } catch (error) {
    toast.error((error as Error).message || '设置场馆失败')
  } finally {
    acting.value = false
  }
}

const openEditDialog = (venue: Venue) => {
  editingVenue.value = venue
  Object.assign(editForm, {
    real_name: venue.real_name,
    nickname: venue.nickname,
    phone_number: venue.phone_number,
  })
  editError.value = ''
  editDialogRef.value?.showModal()
}

const handleUpdateVenue = async () => {
  if (!editingVenue.value) return
  acting.value = true
  editError.value = ''
  try {
    await updateVenue(editingVenue.value.id, {
      real_name: editForm.real_name || undefined,
      nickname: editForm.nickname || undefined,
      phone_number: editForm.phone_number || undefined,
    })
    editDialogRef.value?.close()
    await fetchVenues()
    toast.success('场馆信息已更新')
  } catch (error) {
    editError.value = (error as Error).message || '更新场馆信息失败'
  } finally {
    acting.value = false
  }
}

const openPasswordDialog = (venue: Venue) => {
  passwordTarget.value = venue
  passwordForm.password = ''
  passwordError.value = ''
  passwordDialogRef.value?.showModal()
}

const handleChangePassword = async () => {
  if (!passwordTarget.value) return
  if (!passwordForm.password) {
    passwordError.value = '请输入新密码'
    return
  }
  acting.value = true
  passwordError.value = ''
  try {
    await changeVenuePassword(passwordTarget.value.id, { password: passwordForm.password })
    passwordDialogRef.value?.close()
    toast.success('密码已更新')
  } catch (error) {
    passwordError.value = (error as Error).message || '修改密码失败'
  } finally {
    acting.value = false
  }
}

const openFreezeDialog = (venue: Venue) => {
  freezeTarget.value = venue
  const now = new Date()
  freezeForm.start = now.toISOString().slice(0, 16)
  freezeForm.end = ''
  freezeError.value = ''
  freezeDialogRef.value?.showModal()
}

const handleFreezeVenue = async () => {
  if (!freezeTarget.value || !freezeForm.start) {
    freezeError.value = '请填写冻结开始时间'
    return
  }
  acting.value = true
  freezeError.value = ''
  try {
    await freezeVenue(freezeTarget.value.id, {
      freeze_start_time: `${freezeForm.start}:00`,
      freeze_end_time: freezeForm.end ? `${freezeForm.end}:00` : undefined,
    })
    freezeDialogRef.value?.close()
    await fetchVenues()
    toast.success('场馆已冻结')
  } catch (error) {
    freezeError.value = (error as Error).message || '冻结场馆失败'
  } finally {
    acting.value = false
  }
}

const handleUnfreeze = async (venue: Venue) => {
  acting.value = true
  try {
    await unfreezeVenue(venue.id)
    await fetchVenues()
    toast.success('场馆已解冻')
  } catch (error) {
    toast.error((error as Error).message || '解冻场馆失败')
  } finally {
    acting.value = false
  }
}

const openRemoveDialog = (venue: Venue) => {
  removeTarget.value = venue
  removeDialogRef.value?.showModal()
}

const handleRemoveVenue = async () => {
  if (!removeTarget.value) return
  acting.value = true
  try {
    await removeVenue(removeTarget.value.id)
    removeDialogRef.value?.close()
    await fetchVenues()
    toast.success(isStandaloneVenue(removeTarget.value) ? '场馆账号已删除' : '场馆身份已移除')
  } catch (error) {
    toast.error((error as Error).message || '删除场馆失败')
  } finally {
    acting.value = false
  }
}

onMounted(fetchVenues)
</script>
