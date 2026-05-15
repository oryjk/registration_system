<template>
  <div class="card bg-base-100 border border-base-300 shadow-sm">
    <div class="card-body p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-base">队员列表（{{ detail.member_count }}）</h3>
        <button class="btn btn-primary btn-sm gap-1" @click="emit('add')">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          添加队员
        </button>
      </div>

      <div
        v-if="selectedMemberIds.length > 0"
        class="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10 mb-4"
      >
        <span class="text-sm"
          >已选 <strong>{{ selectedMemberIds.length }}</strong> 人</span
        >
        <div class="flex-1"></div>
        <button class="btn btn-sm btn-ghost" @click="emit('clearSelection')">清空</button>
        <button class="btn btn-sm btn-error btn-outline gap-1" @click="emit('batchRemove')">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
            />
          </svg>
          批量移除
        </button>
        <button class="btn btn-sm btn-warning btn-outline gap-1" @click="emit('batchFreeze')">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
            />
          </svg>
          批量冻结
        </button>
        <button class="btn btn-sm btn-success btn-outline gap-1" @click="emit('batchUnfreeze')">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
          批量解冻
        </button>
      </div>

      <div
        v-if="detail.members.length === 0"
        class="flex flex-col items-center py-10 text-base-content/40"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-10 w-10"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"
          />
        </svg>
        <p class="mt-2 text-sm">暂无队员</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th class="w-10">
                <label class="flex justify-center">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    :checked="allMembersSelected"
                    @change="emit('toggleSelectAll')"
                  />
                </label>
              </th>
              <th>球员</th>
              <th>手机号</th>
              <th>角色</th>
              <th>会员</th>
              <th>号码</th>
              <th>加入时间</th>
              <th class="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="member in detail.members" :key="member.user_id">
              <td>
                <label class="flex justify-center">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    :checked="selectedMemberIds.includes(member.user_id)"
                    @change="emit('toggleMember', member.user_id)"
                  />
                </label>
              </td>
              <td>
                <div class="flex items-center gap-2.5">
                  <div
                    class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
                    :class="member.avatar_url ? '' : roleColors[member.role] || 'bg-base-300'"
                  >
                    <img
                      v-if="member.avatar_url"
                      :src="member.avatar_url"
                      class="w-full h-full object-cover"
                      @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <span class="text-sm font-bold">{{
                        (member.real_name || member.nickname || '?').charAt(0)
                      }}</span>
                    </div>
                  </div>
                  <div>
                    <p class="font-semibold text-sm leading-none">
                      {{ member.real_name || member.nickname }}
                    </p>
                    <p
                      v-if="member.real_name && member.nickname !== member.real_name"
                      class="text-xs text-base-content/50 mt-0.5"
                    >
                      @{{ member.nickname }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="text-sm font-mono text-base-content/60">
                {{ member.phone_number || '-' }}
              </td>
              <td>
                <span class="badge badge-sm" :class="roleBadgeClass[member.role] || 'badge-ghost'">
                  {{ member.role_label }}
                </span>
              </td>
              <td>
                <span
                  class="badge badge-sm"
                  :class="member.is_member ? 'badge-primary' : 'badge-ghost'"
                >
                  {{ member.is_member ? '队员会员' : '普通队员' }}
                </span>
              </td>
              <td class="text-sm">
                {{ member.jersey_number ? '#' + member.jersey_number : '-' }}
              </td>
              <td class="text-xs text-base-content/50">{{ formatDate(member.joined_at) }}</td>
              <td class="text-right">
                <div class="flex gap-1 justify-end">
                  <button class="btn btn-xs btn-outline" @click="emit('setRole', member)">
                    设置角色
                  </button>
                  <button
                    class="btn btn-xs btn-error btn-outline"
                    @click="emit('remove', member)"
                  >
                    移除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TeamDetailForAdmin, TeamMemberWithInfo } from '@/services/team'
import { formatDate, roleBadgeClass, roleColors } from './team-detail.model'

defineProps<{
  detail: TeamDetailForAdmin
  selectedMemberIds: number[]
  allMembersSelected: boolean
}>()

const emit = defineEmits<{
  add: []
  clearSelection: []
  batchRemove: []
  batchFreeze: []
  batchUnfreeze: []
  toggleSelectAll: []
  toggleMember: [userId: number]
  setRole: [member: TeamMemberWithInfo]
  remove: [member: TeamMemberWithInfo]
}>()
</script>
