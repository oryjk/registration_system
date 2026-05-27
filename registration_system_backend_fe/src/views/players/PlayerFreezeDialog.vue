<template>
  <dialog ref="freezeDialogRef" class="modal">
    <div class="modal-box max-w-md">
      <h3 class="text-lg font-bold mb-1">冻结用户</h3>
      <p class="text-sm text-base-content/50 mb-4">
        冻结后用户将无法正常使用小程序功能。设置冻结期间后点击确认。
      </p>
      <div v-if="freezeTarget" class="flex items-center gap-3 p-3 bg-base-200 rounded-xl mb-4">
        <div
          class="w-10 h-10 rounded-full bg-base-300 overflow-hidden flex items-center justify-center flex-shrink-0"
        >
          <img
            v-if="freezeTarget.avatar_url"
            :src="freezeTarget.avatar_url"
            class="w-full h-full object-cover"
          />
          <span v-else class="text-sm font-bold text-base-content/60">{{
            (freezeTarget.real_name || freezeTarget.nickname).charAt(0)
          }}</span>
        </div>
        <div>
          <p class="font-semibold text-sm">{{ freezeTarget.real_name || freezeTarget.nickname }}</p>
          <p class="text-xs text-base-content/50">ID: {{ freezeTarget.id }}</p>
        </div>
      </div>
      <div v-if="freezeError" class="alert alert-error py-2.5 mb-4 text-sm">{{ freezeError }}</div>
      <form @submit.prevent="emit('freezeSubmit')" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">冻结开始时间 <span class="text-error">*</span></span>
          <input
            v-model="freezeForm.start"
            type="datetime-local"
            required
            class="input input-bordered border-2 h-11"
          />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">
            冻结结束时间
            <span class="text-base-content/40 font-normal ml-1">（可选，不填则长期冻结）</span>
          </span>
          <input
            v-model="freezeForm.end"
            type="datetime-local"
            class="input input-bordered border-2 h-11"
          />
        </label>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="closeFreeze">取消</button>
          <button type="submit" class="btn btn-warning" :disabled="freezing">
            <span v-if="freezing" class="loading loading-spinner loading-sm"></span>
            确认冻结
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <dialog ref="unfreezeDialogRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">确认解冻</h3>
      <p class="py-4 text-base-content/70">
        确定解冻用户 <strong>{{ unfreezeTarget?.real_name || unfreezeTarget?.nickname }}</strong
        >？解冻后用户可正常使用小程序功能。
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="closeUnfreeze">取消</button>
        <button class="btn btn-success" :disabled="unfreezing" @click="emit('unfreezeSubmit')">
          <span v-if="unfreezing" class="loading loading-spinner loading-sm"></span>
          确认解冻
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <dialog ref="deleteDialogRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">确认删除</h3>
      <p class="py-4 text-base-content/70">
        确定删除用户 <strong>{{ deletingPlayer?.real_name || deletingPlayer?.nickname }}</strong
        >？该操作不可撤销，同时会删除其所有报名记录。
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="closeDelete">取消</button>
        <button class="btn btn-error" :disabled="deleting" @click="emit('deleteSubmit')">
          <span v-if="deleting" class="loading loading-spinner loading-sm"></span>
          确认删除
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <dialog ref="batchDeleteDialogRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">确认批量删除</h3>
      <p class="py-4 text-base-content/70">
        确定删除选中的
        <strong>{{ selectedPlayerCount }}</strong>
        名用户？该操作不可撤销，同时会删除其所有报名记录。
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="closeBatchDelete">取消</button>
        <button class="btn btn-error" :disabled="batchDeleting" @click="emit('batchDeleteSubmit')">
          <span v-if="batchDeleting" class="loading loading-spinner loading-sm"></span>
          确认删除
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Player } from '@/services/player'

export interface PlayerFreezeFormState {
  start: string
  end: string
}

defineProps<{
  freezeTarget: Player | null
  freezeForm: PlayerFreezeFormState
  freezeError: string
  freezing: boolean
  unfreezeTarget: Player | null
  unfreezing: boolean
  deletingPlayer: Player | null
  deleting: boolean
  selectedPlayerCount: number
  batchDeleting: boolean
}>()

const emit = defineEmits<{
  freezeSubmit: []
  unfreezeSubmit: []
  deleteSubmit: []
  batchDeleteSubmit: []
}>()

const freezeDialogRef = ref<HTMLDialogElement>()
const unfreezeDialogRef = ref<HTMLDialogElement>()
const deleteDialogRef = ref<HTMLDialogElement>()
const batchDeleteDialogRef = ref<HTMLDialogElement>()

const showFreeze = () => freezeDialogRef.value?.showModal()
const closeFreeze = () => freezeDialogRef.value?.close()
const showUnfreeze = () => unfreezeDialogRef.value?.showModal()
const closeUnfreeze = () => unfreezeDialogRef.value?.close()
const showDelete = () => deleteDialogRef.value?.showModal()
const closeDelete = () => deleteDialogRef.value?.close()
const showBatchDelete = () => batchDeleteDialogRef.value?.showModal()
const closeBatchDelete = () => batchDeleteDialogRef.value?.close()

defineExpose({
  showFreeze,
  closeFreeze,
  showUnfreeze,
  closeUnfreeze,
  showDelete,
  closeDelete,
  showBatchDelete,
  closeBatchDelete,
})
</script>
