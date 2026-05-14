<template>
  <dialog ref="dialogRef" class="modal">
    <div class="modal-box max-w-lg">
      <h3 class="text-lg font-bold mb-1">分配球队管理员</h3>
      <p class="text-sm text-base-content/50 mb-4">
        选择一名管理员负责管理该球队，被分配后可登录后台查看和管理此球队
      </p>

      <div v-if="allAdmins.length === 0" class="flex justify-center py-8">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>

      <div
        v-else
        class="max-h-72 overflow-y-auto flex flex-col gap-1 border border-base-200 rounded-xl p-2 mb-4"
      >
        <div
          v-for="admin in availableAdmins"
          :key="admin.id"
          class="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
          :class="
            selectedAdmin?.id === admin.id ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-base-200'
          "
          @click="selectedAdmin = admin"
        >
          <div
            class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
          >
            <span class="text-sm font-bold text-primary">{{
              (admin.nickname || admin.username).charAt(0).toUpperCase()
            }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold leading-none">{{ admin.nickname || admin.username }}</p>
            <p class="text-xs text-base-content/50 mt-0.5">@{{ admin.username }}</p>
          </div>
          <svg
            v-if="selectedAdmin?.id === admin.id"
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-primary"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
        <div
          v-if="availableAdmins.length === 0"
          class="text-center text-sm text-base-content/40 py-6"
        >
          所有管理员均已被分配
        </div>
      </div>

      <div v-if="assignAdminError" class="alert alert-error py-2 text-sm mb-3">
        {{ assignAdminError }}
      </div>

      <div class="modal-action">
        <button type="button" class="btn btn-ghost" @click="close">取消</button>
        <button
          class="btn btn-primary"
          :disabled="!selectedAdmin || assigningAdmin"
          @click="emit('submit')"
        >
          <span v-if="assigningAdmin" class="loading loading-spinner loading-sm"></span>
          确认分配
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { AdminUser } from '@/services/auth'

defineProps<{
  allAdmins: AdminUser[]
  availableAdmins: AdminUser[]
  assigningAdmin: boolean
  assignAdminError: string
}>()

const selectedAdmin = defineModel<AdminUser | null>('selectedAdmin', { required: true })
const emit = defineEmits<{
  submit: []
}>()

const dialogRef = ref<HTMLDialogElement>()

const showModal = () => dialogRef.value?.showModal()
const close = () => dialogRef.value?.close()

defineExpose({
  showModal,
  close,
})
</script>
