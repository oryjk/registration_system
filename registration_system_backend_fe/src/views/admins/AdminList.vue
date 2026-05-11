<template>
  <div class="flex flex-col gap-6">
    <!-- 页面标题 + 新增按钮 -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold">管理员管理</h2>
        <p class="text-sm text-base-content/60 mt-0.5">管理系统管理员账号，设置权限与状态</p>
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
        新增管理员
      </button>
    </div>

    <!-- 管理员列表 -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <!-- 加载中 -->
      <div v-if="loading" class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>昵称</th>
              <th>权限</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in 4" :key="i">
              <td><div class="skeleton h-4 w-6"></div></td>
              <td>
                <div class="flex items-center gap-2">
                  <div class="skeleton h-8 w-8 rounded-full"></div>
                  <div class="skeleton h-4 w-20"></div>
                </div>
              </td>
              <td><div class="skeleton h-4 w-16"></div></td>
              <td><div class="skeleton h-5 w-20 rounded-full"></div></td>
              <td><div class="skeleton h-5 w-10 rounded-full"></div></td>
              <td>
                <div class="flex gap-1">
                  <div class="skeleton h-7 w-12"></div>
                  <div class="skeleton h-7 w-12"></div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 错误 -->
      <div v-else-if="loadError" class="flex flex-col items-center justify-center py-16 gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-12 w-12 text-error/60"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
          />
        </svg>
        <p class="text-base-content/60">{{ loadError }}</p>
        <button class="btn btn-sm btn-outline" @click="fetchAdmins">重试</button>
      </div>

      <!-- 列表 -->
      <div v-else class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>昵称</th>
              <th>权限</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="admins.length === 0">
              <td colspan="6" class="text-center py-12 text-base-content/40">暂无管理员</td>
            </tr>
            <tr v-for="admin in admins" :key="admin.id">
              <td class="text-base-content/60 text-sm">{{ admin.id }}</td>
              <td>
                <div class="flex items-center gap-2">
                  <div class="avatar placeholder">
                    <div class="w-8 rounded-full bg-primary/10 text-primary">
                      <span class="text-sm font-semibold">{{
                        admin.nickname?.charAt(0) || admin.username.charAt(0)
                      }}</span>
                    </div>
                  </div>
                  <span class="font-medium">{{ admin.username }}</span>
                </div>
              </td>
              <td>{{ admin.nickname || '—' }}</td>
              <td>
                <span
                  class="badge badge-sm gap-1"
                  :class="admin.is_super_admin ? 'badge-warning' : 'badge-ghost'"
                >
                  <svg
                    v-if="admin.is_super_admin"
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                  </svg>
                  {{ admin.is_super_admin ? '超级管理员' : '普通管理员' }}
                </span>
              </td>
              <td>
                <span
                  class="badge badge-sm"
                  :class="admin.status === 1 ? 'badge-success' : 'badge-error'"
                >
                  {{ admin.status === 1 ? '正常' : '禁用' }}
                </span>
              </td>
              <td>
                <div class="flex items-center gap-1">
                  <!-- 禁用/启用 -->
                  <button
                    class="btn btn-xs"
                    :class="admin.status === 1 ? 'btn-warning' : 'btn-success'"
                    :disabled="admin.is_super_admin"
                    @click="toggleStatus(admin)"
                    :title="admin.is_super_admin ? '超级管理员不可操作' : ''"
                  >
                    {{ admin.status === 1 ? '禁用' : '启用' }}
                  </button>
                  <!-- 删除 -->
                  <button
                    class="btn btn-xs btn-error btn-outline"
                    :disabled="admin.is_super_admin"
                    @click="confirmDelete(admin)"
                    :title="admin.is_super_admin ? '超级管理员不可删除' : ''"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- 新增管理员弹窗 -->
  <dialog ref="createModalRef" class="modal">
    <div class="modal-box w-full max-w-md">
      <h3 class="text-lg font-bold mb-1">新增管理员</h3>
      <p class="text-sm text-base-content/60 mb-5">创建新的管理员账号</p>

      <div v-if="createError" role="alert" class="alert alert-error py-2.5 mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 shrink-0"
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
        <span class="text-sm">{{ createError }}</span>
      </div>

      <form @submit.prevent="handleCreate" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">用户名 <span class="text-error">*</span></span>
          <input
            v-model="createForm.username"
            type="text"
            placeholder="请输入用户名"
            class="input input-bordered border-2 w-full h-11"
            required
          />
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">昵称</span>
          <input
            v-model="createForm.nickname"
            type="text"
            placeholder="请输入昵称（可选）"
            class="input input-bordered border-2 w-full h-11"
          />
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">密码 <span class="text-error">*</span></span>
          <input
            v-model="createForm.password"
            type="password"
            placeholder="请输入密码（至少 6 位）"
            class="input input-bordered border-2 w-full h-11"
            required
          />
        </label>

        <label class="flex items-center gap-3 cursor-pointer">
          <input
            v-model="createForm.is_super_admin"
            type="checkbox"
            class="checkbox checkbox-warning checkbox-sm"
          />
          <div>
            <span class="text-sm font-semibold">设为超级管理员</span>
            <p class="text-xs text-base-content/50 mt-0.5">超级管理员可管理所有球队及其他管理员</p>
          </div>
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

  <!-- 删除确认弹窗 -->
  <dialog ref="deleteModalRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">确认删除</h3>
      <p class="py-4 text-base-content/70">
        确定要删除管理员
        <strong class="text-base-content">{{ deletingAdmin?.username }}</strong>
        吗？此操作不可撤销。
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
import { toast } from '@/utils/toast'
import {
  listAdmins,
  register,
  updateAdminStatus,
  deleteAdmin,
  type AdminUser,
} from '@/services/auth'

const admins = ref<AdminUser[]>([])
const loading = ref(false)
const loadError = ref('')

// 新增弹窗
const createModalRef = ref<HTMLDialogElement>()
const creating = ref(false)
const createError = ref('')
const createForm = reactive({
  username: '',
  nickname: '',
  password: '',
  is_super_admin: false,
})

// 删除弹窗
const deleteModalRef = ref<HTMLDialogElement>()
const deleting = ref(false)
const deletingAdmin = ref<AdminUser | null>(null)

const fetchAdmins = async () => {
  loading.value = true
  loadError.value = ''
  try {
    admins.value = await listAdmins()
  } catch (e: unknown) {
    loadError.value = (e as Error).message || '加载失败'
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  createError.value = ''
  createForm.username = ''
  createForm.nickname = ''
  createForm.password = ''
  createForm.is_super_admin = false
  createModalRef.value?.showModal()
}

const closeCreateModal = () => createModalRef.value?.close()

const handleCreate = async () => {
  if (createForm.password.length < 6) {
    createError.value = '密码长度不能少于 6 位'
    return
  }
  creating.value = true
  createError.value = ''
  try {
    const newAdmin = await register({
      username: createForm.username,
      password: createForm.password,
      nickname: createForm.nickname || undefined,
      is_super_admin: createForm.is_super_admin,
    })
    admins.value.push(newAdmin)
    closeCreateModal()
  } catch (e: unknown) {
    createError.value = (e as Error).message || '创建失败'
  } finally {
    creating.value = false
  }
}

const toggleStatus = async (admin: AdminUser) => {
  const newStatus = admin.status === 1 ? 0 : 1
  try {
    await updateAdminStatus(admin.id, { status: newStatus })
    admin.status = newStatus
  } catch (e: unknown) {
    toast.error((e as Error).message || '操作失败')
  }
}

const confirmDelete = (admin: AdminUser) => {
  deletingAdmin.value = admin
  deleteModalRef.value?.showModal()
}

const closeDeleteModal = () => {
  deleteModalRef.value?.close()
  deletingAdmin.value = null
}

const handleDelete = async () => {
  if (!deletingAdmin.value) return
  deleting.value = true
  try {
    await deleteAdmin(deletingAdmin.value.id)
    admins.value = admins.value.filter((a) => a.id !== deletingAdmin.value!.id)
    closeDeleteModal()
  } catch (e: unknown) {
    toast.error((e as Error).message || '删除失败')
  } finally {
    deleting.value = false
  }
}

onMounted(fetchAdmins)
</script>
