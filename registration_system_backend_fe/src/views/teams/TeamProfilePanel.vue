<template>
  <div class="card bg-base-100 border border-base-300 shadow-sm">
    <div class="card-body p-5">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-4">
          <div v-if="detail.team.logo_url" class="avatar">
            <div class="w-16 rounded-xl"><img :src="detail.team.logo_url" /></div>
          </div>
          <div
            v-else
            class="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-9 w-9 text-primary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
              />
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-bold">{{ detail.team.name }}</h2>
              <span
                class="badge"
                :class="detail.team.status === 1 ? 'badge-success' : 'badge-error'"
              >
                {{ detail.team.status === 1 ? '正常' : '已解散' }}
              </span>
            </div>
            <p class="text-sm text-base-content/60 mt-1">
              {{ detail.team.description || '暂无简介' }}
            </p>
            <p class="text-xs text-base-content/40 mt-1 font-mono">ID: {{ detail.team.id }}</p>
          </div>
        </div>
        <button class="btn btn-sm btn-outline gap-1 flex-shrink-0" @click="emit('edit')">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
            />
          </svg>
          编辑
        </button>
      </div>

      <div class="flex flex-wrap gap-4 mt-4 pt-4 border-t border-base-200">
        <div class="flex items-center gap-2 text-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-primary"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"
            />
          </svg>
          <span
            ><strong>{{ detail.member_count }}</strong> 名成员</span
          >
        </div>

        <div class="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-warning"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            />
          </svg>
          <span class="text-sm">队长：</span>
          <template v-if="captainMember">
            <div class="avatar placeholder">
              <div class="w-6 h-6 rounded-full bg-warning text-warning-content overflow-hidden">
                <img
                  v-if="captainMember.avatar_url"
                  :src="captainMember.avatar_url"
                  class="w-full h-full object-cover"
                />
                <span v-else class="text-xs font-bold">{{
                  (captainMember.real_name || captainMember.nickname).charAt(0)
                }}</span>
              </div>
            </div>
            <span class="text-sm font-medium">{{
              captainMember.real_name || captainMember.nickname
            }}</span>
          </template>
          <span v-else class="text-sm text-warning">未设置</span>
          <button class="btn btn-xs btn-ghost" @click="emit('setCaptain')">更换</button>
        </div>

        <div class="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-primary"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
          </svg>
          <span class="text-sm">领队：</span>
          <template v-if="leaderMember">
            <div class="avatar placeholder">
              <div class="w-6 h-6 rounded-full bg-primary text-primary-content overflow-hidden">
                <img
                  v-if="leaderMember.avatar_url"
                  :src="leaderMember.avatar_url"
                  class="w-full h-full object-cover"
                />
                <span v-else class="text-xs font-bold">{{
                  (leaderMember.real_name || leaderMember.nickname).charAt(0)
                }}</span>
              </div>
            </div>
            <span class="text-sm font-medium">{{
              leaderMember.real_name || leaderMember.nickname
            }}</span>
          </template>
          <span v-else class="text-sm text-base-content/40">未设置</span>
          <button class="btn btn-xs btn-ghost" @click="emit('setLeader')">更换</button>
        </div>

        <div class="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-secondary"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
            />
          </svg>
          <span class="text-sm">二场队长：</span>
          <template v-if="viceCaptainMember">
            <div class="avatar placeholder">
              <div class="w-6 h-6 rounded-full bg-secondary text-secondary-content overflow-hidden">
                <img
                  v-if="viceCaptainMember.avatar_url"
                  :src="viceCaptainMember.avatar_url"
                  class="w-full h-full object-cover"
                />
                <span v-else class="text-xs font-bold">{{
                  (viceCaptainMember.real_name || viceCaptainMember.nickname).charAt(0)
                }}</span>
              </div>
            </div>
            <span class="text-sm font-medium">{{
              viceCaptainMember.real_name || viceCaptainMember.nickname
            }}</span>
          </template>
          <span v-else class="text-sm text-base-content/40">未设置</span>
          <button class="btn btn-xs btn-ghost" @click="emit('setViceCaptain')">更换</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TeamDetailForAdmin, TeamMemberWithInfo } from '@/services/team'

defineProps<{
  detail: TeamDetailForAdmin
  captainMember: TeamMemberWithInfo | null
  leaderMember: TeamMemberWithInfo | null
  viceCaptainMember: TeamMemberWithInfo | null
}>()

const emit = defineEmits<{
  edit: []
  setCaptain: []
  setLeader: []
  setViceCaptain: []
}>()
</script>
