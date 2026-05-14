<template>
  <dialog ref="dialogRef" class="modal">
    <div class="modal-box max-w-lg">
      <h3 class="text-lg font-bold mb-4">编辑球队信息</h3>
      <div v-if="editError" class="alert alert-error py-2.5 mb-4 text-sm">{{ editError }}</div>
      <form @submit.prevent="emit('submit')" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">球队名称</span>
          <input v-model="form.name" type="text" class="input input-bordered border-2 h-11" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">简介</span>
          <textarea
            v-model="form.description"
            rows="3"
            class="textarea textarea-bordered border-2 resize-none"
          ></textarea>
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">队徽 URL</span>
          <input v-model="form.logo_url" type="url" class="input input-bordered border-2 h-11" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">状态</span>
          <select v-model.number="form.status" class="select select-bordered border-2 h-11">
            <option :value="1">正常</option>
            <option :value="0">解散</option>
          </select>
        </label>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="close">取消</button>
          <button type="submit" class="btn btn-primary" :disabled="editing">
            <span v-if="editing" class="loading loading-spinner loading-sm"></span>
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

export interface TeamEditFormState {
  name: string
  description: string
  logo_url: string
  status: number
}

defineProps<{
  editing: boolean
  editError: string
}>()

const form = defineModel<TeamEditFormState>('form', { required: true })
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
