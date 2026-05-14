<template>
  <dialog ref="dialogRef" class="modal">
    <div class="modal-box max-w-md">
      <h3 class="text-lg font-bold mb-4">{{ mode === 'create' ? '新建球员' : '编辑球员信息' }}</h3>
      <div v-if="error" class="alert alert-error py-2.5 mb-4 text-sm">{{ error }}</div>
      <form @submit.prevent="emit('submit')" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">
            真实姓名 <span v-if="mode === 'create'" class="text-error">*</span>
          </span>
          <input
            v-model="form.real_name"
            type="text"
            :required="mode === 'create'"
            class="input input-bordered border-2 h-11"
            placeholder="请输入真实姓名"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">昵称</span>
          <input
            v-model="form.nickname"
            type="text"
            class="input input-bordered border-2 h-11"
            placeholder="可选"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">手机号</span>
          <input
            v-model="form.phone_number"
            type="tel"
            class="input input-bordered border-2 h-11"
            placeholder="可选"
          />
        </label>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="close">取消</button>
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
            {{ mode === 'create' ? '创建' : '保存' }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'

export interface PlayerEditFormState {
  real_name: string
  nickname: string
  phone_number: string
}

defineProps<{
  mode: 'create' | 'edit'
  submitting: boolean
  error: string
}>()

const form = defineModel<PlayerEditFormState>('form', { required: true })
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
