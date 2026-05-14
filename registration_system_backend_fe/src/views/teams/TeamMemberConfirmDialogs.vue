<template>
  <dialog ref="removeMemberDialogRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">确认移除</h3>
      <p class="py-4 text-base-content/70">
        确定要将
        <strong>{{ removingMember ? removingMember.real_name || removingMember.nickname : '' }}</strong>
        从球队移除吗？
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="closeRemove">取消</button>
        <button class="btn btn-error" :disabled="removingMemberLoading" @click="emit('remove')">
          <span v-if="removingMemberLoading" class="loading loading-spinner loading-sm"></span>
          确认移除
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>

  <dialog ref="batchRemoveDialogRef" class="modal">
    <div class="modal-box max-w-sm">
      <h3 class="text-lg font-bold">确认批量移除</h3>
      <p class="py-4 text-base-content/70">
        确定要将选中的 <strong>{{ selectedMemberCount }}</strong> 名队员从球队移除吗？
      </p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="closeBatchRemove">取消</button>
        <button class="btn btn-error" :disabled="batchRemoving" @click="emit('batchRemove')">
          <span v-if="batchRemoving" class="loading loading-spinner loading-sm"></span>
          确认移除
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { TeamMemberWithInfo } from '@/services/team'

defineProps<{
  removingMember: TeamMemberWithInfo | null
  removingMemberLoading: boolean
  selectedMemberCount: number
  batchRemoving: boolean
}>()

const emit = defineEmits<{
  remove: []
  batchRemove: []
}>()

const removeMemberDialogRef = ref<HTMLDialogElement>()
const batchRemoveDialogRef = ref<HTMLDialogElement>()

const showRemove = () => removeMemberDialogRef.value?.showModal()
const closeRemove = () => removeMemberDialogRef.value?.close()
const showBatchRemove = () => batchRemoveDialogRef.value?.showModal()
const closeBatchRemove = () => batchRemoveDialogRef.value?.close()

defineExpose({
  showRemove,
  closeRemove,
  showBatchRemove,
  closeBatchRemove,
})
</script>
