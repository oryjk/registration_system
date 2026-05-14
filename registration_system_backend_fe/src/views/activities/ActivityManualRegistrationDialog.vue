<template>
  <dialog ref="dialogRef" class="modal">
    <div class="modal-box max-w-lg">
      <h3 class="text-lg font-bold mb-1">手动报名</h3>
      <p class="text-sm text-base-content/50 mb-4">搜索球员，设置报名状态后提交</p>

      <div class="flex gap-2 mb-4">
        <label class="input input-bordered border-2 flex items-center gap-2 flex-1 h-11">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-base-content/40"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
            />
          </svg>
          <input
            v-model="keyword"
            type="text"
            class="grow bg-transparent outline-none text-sm"
            placeholder="搜索昵称或真实姓名..."
            @input="emit('search')"
          />
          <span v-if="searching" class="loading loading-spinner loading-xs"></span>
        </label>
      </div>

      <div
        v-if="searchResults.length > 0"
        class="max-h-52 overflow-y-auto flex flex-col gap-1 border border-base-200 rounded-xl p-2 mb-4"
      >
        <div
          v-for="player in searchResults"
          :key="player.id"
          class="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
          :class="target?.id === player.id ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-base-200'"
          @click="target = player"
        >
          <div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
            <img v-if="player.avatar_url" :src="player.avatar_url" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center">
              <span class="text-sm font-bold text-base-content/60">{{
                (player.real_name || player.nickname).charAt(0)
              }}</span>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold leading-none">
              {{ player.real_name || player.nickname }}
            </p>
            <p v-if="player.nickname !== player.real_name" class="text-xs text-base-content/50 mt-0.5">
              @{{ player.nickname }}
            </p>
          </div>
          <svg
            v-if="target?.id === player.id"
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-primary"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
      </div>
      <div
        v-else-if="keyword && !searching"
        class="text-center text-sm text-base-content/40 py-4 border border-dashed border-base-300 rounded-xl mb-4"
      >
        未找到匹配球员
      </div>

      <div v-if="target" class="flex items-center gap-3 p-3 bg-base-200 rounded-xl mb-4">
        <div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
          <img v-if="target.avatar_url" :src="target.avatar_url" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span class="text-sm font-bold">{{
              (target.real_name || target.nickname).charAt(0)
            }}</span>
          </div>
        </div>
        <div class="flex-1">
          <p class="text-sm font-semibold">{{ target.real_name || target.nickname }}</p>
        </div>
        <select v-model.number="stand" class="select select-bordered select-sm h-9 w-28">
          <option :value="1">参加</option>
          <option :value="2">请假</option>
          <option :value="3">迟到</option>
        </select>
      </div>

      <div v-if="error" class="alert alert-error py-2 text-sm mb-3">{{ error }}</div>

      <div class="modal-action">
        <button type="button" class="btn btn-ghost" @click="close">取消</button>
        <button class="btn btn-primary" :disabled="!target || registering" @click="emit('submit')">
          <span v-if="registering" class="loading loading-spinner loading-sm"></span>
          确认报名
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Player } from '@/services/player'

defineProps<{
  searchResults: Player[]
  searching: boolean
  registering: boolean
  error: string
}>()

const keyword = defineModel<string>('keyword', { required: true })
const target = defineModel<Player | null>('target', { required: true })
const stand = defineModel<number>('stand', { required: true })
const emit = defineEmits<{
  search: []
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
