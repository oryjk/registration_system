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
        <div class="rounded-xl border border-base-300 bg-base-200/40 p-4">
          <div class="flex items-center gap-4">
            <div class="h-16 w-16 overflow-hidden rounded-xl bg-base-300">
              <img
                v-if="form.logo_url"
                :src="form.logo_url"
                alt="球队队徽"
                class="h-full w-full object-cover"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center text-lg font-bold text-base-content/50"
              >
                {{ form.name.charAt(0) || '队' }}
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold">上传队徽</p>
              <p class="mt-1 text-xs text-base-content/50">
                支持 jpg、png、webp，大小不超过 1MB。
              </p>
              <input
                ref="logoInputRef"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="file-input file-input-bordered file-input-sm mt-3 w-full"
                :disabled="uploadingLogo || editing"
                @change="handleLogoFileChange"
              />
            </div>
          </div>
          <p v-if="uploadLogoError" class="mt-2 text-sm text-error">{{ uploadLogoError }}</p>
          <div class="mt-3 flex justify-end">
            <button
              type="button"
              class="btn btn-outline btn-sm"
              :disabled="!selectedLogoFile || uploadingLogo || editing"
              @click="emit('uploadLogo', selectedLogoFile!)"
            >
              <span v-if="uploadingLogo" class="loading loading-spinner loading-xs"></span>
              上传并回填
            </button>
          </div>
        </div>
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
  uploadingLogo: boolean
  uploadLogoError: string
}>()

const form = defineModel<TeamEditFormState>('form', { required: true })
const emit = defineEmits<{
  submit: []
  uploadLogo: [file: File]
}>()

const dialogRef = ref<HTMLDialogElement>()
const logoInputRef = ref<HTMLInputElement>()
const selectedLogoFile = ref<File | null>(null)

const handleLogoFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  selectedLogoFile.value = input.files?.[0] ?? null
}

const showModal = () => {
  selectedLogoFile.value = null
  if (logoInputRef.value) logoInputRef.value.value = ''
  dialogRef.value?.showModal()
}
const close = () => dialogRef.value?.close()

defineExpose({
  showModal,
  close,
})
</script>
