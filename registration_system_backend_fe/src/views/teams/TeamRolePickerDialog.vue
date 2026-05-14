<template>
  <dialog ref="dialogRef" class="modal">
    <div class="modal-box max-w-lg">
      <h3 class="text-lg font-bold mb-1">{{ title }}</h3>
      <p class="text-sm text-base-content/50 mb-4">
        搜索并选择{{ roleName }}，也可以从现有队员中选择
      </p>

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
        class="max-h-72 overflow-y-auto flex flex-col gap-1 border border-base-200 rounded-xl p-2 mb-4"
      >
        <template v-if="keyword">
          <div
            v-if="searchResults.length === 0 && !searching"
            class="text-center text-sm text-base-content/40 py-6"
          >
            未找到匹配球员
          </div>
          <div
            v-for="player in searchResults"
            :key="player.id"
            class="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
            :class="selectedPlayer?.id === player.id ? selectedClass : 'hover:bg-base-200'"
            @click="selectedPlayer = player"
          >
            <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
              <img
                v-if="player.avatar_url"
                :src="player.avatar_url"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <span class="font-bold text-base-content/60">{{
                  (player.real_name || player.nickname).charAt(0)
                }}</span>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-sm leading-none">
                {{ player.real_name || player.nickname }}
              </p>
              <p
                v-if="player.nickname !== player.real_name"
                class="text-xs text-base-content/50 mt-0.5"
              >
                @{{ player.nickname }}
              </p>
            </div>
            <svg
              v-if="selectedPlayer?.id === player.id"
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              :class="iconClass"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
        </template>
        <template v-else>
          <p class="text-xs text-base-content/40 px-1 pb-1">从现有队员中选择</p>
          <div
            v-for="member in members"
            :key="member.user_id"
            class="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
            :class="selectedPlayer?.id === member.user_id ? selectedClass : 'hover:bg-base-200'"
            @click="selectedPlayer = memberToPlayer(member)"
          >
            <div
              class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
              :class="member.avatar_url ? '' : roleBgClass[member.role] || 'bg-base-300'"
            >
              <img
                v-if="member.avatar_url"
                :src="member.avatar_url"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <span class="font-bold text-base-content/60">{{
                  (member.real_name || member.nickname).charAt(0)
                }}</span>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="font-semibold text-sm leading-none">
                  {{ member.real_name || member.nickname }}
                </p>
                <span class="badge badge-xs" :class="roleBadgeClass[member.role] || 'badge-ghost'">
                  {{ member.role_label }}
                </span>
              </div>
              <p
                v-if="member.nickname !== member.real_name"
                class="text-xs text-base-content/50 mt-0.5"
              >
                @{{ member.nickname }}
              </p>
            </div>
            <svg
              v-if="selectedPlayer?.id === member.user_id"
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              :class="iconClass"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
        </template>
      </div>

      <div
        v-if="selectedPlayer"
        class="flex items-center gap-3 p-3 rounded-xl border mb-4"
        :class="previewClass"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 flex-shrink-0"
          :class="iconClass"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path :d="previewIconPath" />
        </svg>
        <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
          <img
            v-if="selectedPlayer.avatar_url"
            :src="selectedPlayer.avatar_url"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span class="text-xs font-bold">{{
              (selectedPlayer.real_name || selectedPlayer.nickname).charAt(0)
            }}</span>
          </div>
        </div>
        <div>
          <p class="text-sm font-semibold">
            将设置 <strong>{{ selectedPlayer.real_name || selectedPlayer.nickname }}</strong> 为{{
              roleName
            }}
          </p>
          <p class="text-xs text-base-content/50">如果此人不在队中，将自动加入队伍</p>
        </div>
      </div>

      <div class="modal-action">
        <button type="button" class="btn btn-ghost" @click="close">取消</button>
        <button
          class="btn"
          :class="confirmButtonClass"
          :disabled="!selectedPlayer || submitting"
          @click="emit('submit')"
        >
          <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
          确认设置{{ roleName }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>关闭</button></form>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Player } from '@/services/player'
import type { TeamMemberWithInfo } from '@/services/team'
import { memberToPlayer, roleBadgeClass, roleBgClass } from './team-detail.model'

defineProps<{
  title: string
  roleName: string
  members: TeamMemberWithInfo[]
  searchResults: Player[]
  searching: boolean
  submitting: boolean
  selectedClass: string
  iconClass: string
  previewClass: string
  confirmButtonClass: string
  previewIconPath: string
}>()

const keyword = defineModel<string>('keyword', { required: true })
const selectedPlayer = defineModel<Player | null>('selectedPlayer', { required: true })

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
