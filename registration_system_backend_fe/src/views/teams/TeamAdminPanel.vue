<template>
  <div class="card bg-base-100 border border-base-300 shadow-sm">
    <div class="card-body p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="font-bold text-base">后台管理员</h3>
          <p class="text-xs text-base-content/50 mt-0.5">分配后，该管理员可登录后台管理此球队</p>
        </div>
        <button class="btn btn-sm btn-primary gap-1" @click="emit('assign')">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          分配管理员
        </button>
      </div>

      <div
        v-if="!assignedAdmins.length"
        class="flex items-center gap-2 text-sm text-base-content/40 py-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
          />
        </svg>
        暂未分配管理员
      </div>

      <div v-else class="flex flex-wrap gap-2">
        <div
          v-for="admin in assignedAdmins"
          :key="admin.admin_id"
          class="flex items-center gap-2 px-3 py-2 bg-base-200 rounded-xl"
        >
          <div
            class="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0"
          >
            <span class="text-xs font-bold text-primary">{{
              (admin.nickname || admin.username).charAt(0).toUpperCase()
            }}</span>
          </div>
          <div class="leading-none">
            <p class="text-sm font-semibold">{{ admin.nickname || admin.username }}</p>
            <p class="text-xs text-base-content/50">@{{ admin.username }}</p>
          </div>
          <button
            class="btn btn-ghost btn-xs btn-square text-error ml-1"
            @click="emit('unassign', admin.admin_id)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TeamAdminInfo } from '@/services/team'

defineProps<{
  assignedAdmins: TeamAdminInfo[]
}>()

const emit = defineEmits<{
  assign: []
  unassign: [adminId: number]
}>()
</script>
