<template>
  <dialog class="modal" :class="{ 'modal-open': open }">
    <div class="modal-box">
      <h3 class="text-lg font-bold">删除{{ challenge?.kind === 'individual' ? '散人报名' : '约队' }}</h3>
      <p class="mt-3 text-sm leading-6 text-base-content/70">
        删除会将记录标记为“已取消”，不会物理删除历史数据。确定删除
        <span class="font-semibold text-base-content">{{ challenge?.title }}</span>
        吗？
      </p>
      <p v-if="error" class="mt-3 text-sm text-error">{{ error }}</p>
      <div class="modal-action">
        <button class="btn btn-ghost" :disabled="saving" @click="emit('close')">取消</button>
        <button class="btn btn-error" :disabled="saving" @click="emit('confirm')">
          {{ saving ? '删除中...' : '确认删除' }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="emit('close')">
      <button>关闭</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import type { Challenge } from '@/services/challenge'

defineProps<{
  open: boolean
  challenge: Challenge | null
  saving: boolean
  error?: string
}>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()
</script>
