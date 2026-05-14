<template>
  <dialog ref="batchStandDialogRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">批量修改报名状态</h3>
      <p class="py-4 text-base-content/70">
        已选 <strong>{{ selectedRegCount }}</strong> 人，将统一设置为：
      </p>
      <div class="flex flex-col gap-2 mb-6">
        <label
          v-for="option in standOptions"
          :key="option.value"
          class="flex items-center gap-3 p-3 rounded-xl border border-base-300 cursor-pointer hover:bg-base-200"
          :class="stand === option.value ? 'bg-primary/10 border-primary' : ''"
        >
          <input
            v-model.number="stand"
            type="radio"
            name="batchStand"
            :value="option.value"
            class="radio radio-primary"
          />
          <span class="badge badge-sm" :class="option.badge">{{ option.label }}</span>
        </label>
      </div>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="closeBatchStand">取消</button>
        <button class="btn btn-primary" :disabled="batchStandSubmitting" @click="emit('batchSubmit')">
          <span v-if="batchStandSubmitting" class="loading loading-spinner loading-sm"></span>
          确认修改
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <dialog ref="cancelDialogRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">确认取消报名</h3>
      <p class="py-4 text-base-content/70">
        确定取消
        <strong>{{ cancelTarget ? cancelTarget.real_name || cancelTarget.nickname : '' }}</strong>
        的报名记录？
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="closeCancel">不取消</button>
        <button class="btn btn-error" :disabled="cancelling" @click="emit('cancelSubmit')">
          <span v-if="cancelling" class="loading loading-spinner loading-sm"></span>
          确认取消报名
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { RegistrationWithInfo } from '@/services/activity'

defineProps<{
  selectedRegCount: number
  batchStandSubmitting: boolean
  cancelTarget: RegistrationWithInfo | null
  cancelling: boolean
}>()

const stand = defineModel<number>('stand', { required: true })
const emit = defineEmits<{
  batchSubmit: []
  cancelSubmit: []
}>()

const standOptions = [
  { value: 1, label: '参加', badge: 'badge-success' },
  { value: 2, label: '请假', badge: 'badge-warning' },
  { value: 3, label: '迟到', badge: 'badge-error' },
]

const batchStandDialogRef = ref<HTMLDialogElement>()
const cancelDialogRef = ref<HTMLDialogElement>()

const showBatchStand = () => batchStandDialogRef.value?.showModal()
const closeBatchStand = () => batchStandDialogRef.value?.close()
const showCancel = () => cancelDialogRef.value?.showModal()
const closeCancel = () => cancelDialogRef.value?.close()

defineExpose({
  showBatchStand,
  closeBatchStand,
  showCancel,
  closeCancel,
})
</script>
