<template>
  <dialog ref="dialogRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold mb-1">设置角色</h3>
      <div v-if="target" class="flex items-center gap-3 p-3 bg-base-200 rounded-xl mb-4">
        <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
          <img v-if="target.avatar_url" :src="target.avatar_url" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span class="font-bold">{{ (target.real_name || target.nickname).charAt(0) }}</span>
          </div>
        </div>
        <div>
          <p class="font-semibold">{{ target.real_name || target.nickname }}</p>
          <p v-if="target.nickname !== target.real_name" class="text-xs text-base-content/50">
            @{{ target.nickname }}
          </p>
        </div>
      </div>
      <form @submit.prevent="emit('submit')" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">角色</span>
          <select v-model="form.role" class="select select-bordered border-2 h-11">
            <option value="member">队员</option>
            <option value="captain">队长</option>
            <option value="leader">领队</option>
            <option value="vice_captain">二场队长</option>
          </select>
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">号码</span>
          <input
            v-model="form.jersey_number"
            type="text"
            placeholder="球衣号码（可选）"
            class="input input-bordered border-2 h-11"
          />
        </label>
        <label class="flex items-center justify-between gap-4 rounded-xl border border-base-300 bg-base-100 px-4 py-3">
          <div>
            <span class="block text-sm font-semibold">队员会员</span>
            <span class="block text-xs text-base-content/50 mt-0.5">用于在队员信息中区分会员身份</span>
          </div>
          <input v-model="form.is_member" type="checkbox" class="toggle toggle-primary" />
        </label>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="close">取消</button>
          <button type="submit" class="btn btn-primary" :disabled="settingRole">
            <span v-if="settingRole" class="loading loading-spinner loading-sm"></span>
            保存
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { TeamMemberWithInfo } from '@/services/team'

export interface TeamSetRoleFormState {
  role: string
  jersey_number: string
  is_member: boolean
}

defineProps<{
  target: TeamMemberWithInfo | null
  settingRole: boolean
}>()

const form = defineModel<TeamSetRoleFormState>('form', { required: true })
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
