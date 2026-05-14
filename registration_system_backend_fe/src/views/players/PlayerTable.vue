<template>
  <div class="card relative border border-base-300 bg-base-100 shadow-sm">
    <div v-if="showInitialLoading" class="overflow-x-auto">
      <table class="table min-w-[1180px]">
        <thead>
          <tr>
            <th class="w-10"></th>
            <th>球员信息</th>
            <th>手机号</th>
            <th>所属球队</th>
            <th>最近登录</th>
            <th>注册时间</th>
            <th>状态</th>
            <th class="text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in 8" :key="i">
            <td><div class="skeleton h-4 w-4"></div></td>
            <td>
              <div class="flex items-center gap-3">
                <div class="skeleton h-10 w-10 rounded-full"></div>
                <div class="space-y-2">
                  <div class="skeleton h-4 w-24"></div>
                  <div class="skeleton h-3 w-12"></div>
                </div>
              </div>
            </td>
            <td><div class="skeleton h-4 w-28"></div></td>
            <td><div class="skeleton h-5 w-16 rounded-full"></div></td>
            <td><div class="skeleton h-4 w-24"></div></td>
            <td><div class="skeleton h-4 w-24"></div></td>
            <td><div class="skeleton h-5 w-12 rounded-full"></div></td>
            <td class="text-right"><div class="skeleton h-7 w-28 ml-auto"></div></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="loadError" class="flex flex-col items-center justify-center py-16 gap-3">
      <p class="text-base-content/60 text-sm">{{ loadError }}</p>
      <button class="btn btn-sm btn-outline" @click="emit('retry')">重试</button>
    </div>

    <div v-else-if="players.length === 0" class="flex flex-col items-center justify-center py-16 gap-3">
      <p class="text-base-content/40 text-sm">暂无球员数据</p>
    </div>

    <div v-else :class="loading ? 'pointer-events-none opacity-70' : ''">
      <div
        v-if="selectedPlayerIds.length > 0"
        class="flex items-center gap-3 p-3 bg-error/5 rounded-xl border border-error/10 m-4"
      >
        <span class="text-sm"
          >已选 <strong>{{ selectedPlayerIds.length }}</strong> 人</span
        >
        <div class="flex-1"></div>
        <button class="btn btn-sm btn-ghost" @click="emit('clearSelection')">清空</button>
        <button class="btn btn-sm btn-error btn-outline gap-1" @click="emit('batchDelete')">
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
          批量删除
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="table table-zebra min-w-[1180px]">
          <thead>
            <tr>
              <th class="w-10">
                <label class="flex justify-center">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    :checked="allPlayersSelected"
                    @change="emit('toggleSelectAll')"
                  />
                </label>
              </th>
              <th>球员信息</th>
              <th>手机号</th>
              <th>所属球队</th>
              <th class="select-none">
                <SortButton
                  label="最近登录"
                  field="latest_login_date"
                  :sort-by="sortBy"
                  :sort-order="sortOrder"
                  @sort="emit('sort', $event)"
                />
              </th>
              <th class="select-none">
                <SortButton
                  label="注册时间"
                  field="create_time"
                  :sort-by="sortBy"
                  :sort-order="sortOrder"
                  @sort="emit('sort', $event)"
                />
              </th>
              <th class="select-none">
                <SortButton
                  label="状态"
                  field="status"
                  :sort-by="sortBy"
                  :sort-order="sortOrder"
                  @sort="emit('sort', $event)"
                />
              </th>
              <th class="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="player in players" :key="player.id" class="hover:bg-base-200/50 transition-colors">
              <td>
                <label class="flex justify-center">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    :checked="selectedPlayerIds.includes(player.id)"
                    @change="emit('togglePlayer', player.id)"
                  />
                </label>
              </td>
              <td class="min-w-[220px]">
                <div class="flex items-center gap-3">
                  <div class="avatar">
                    <div class="w-10 rounded-full bg-base-300 overflow-hidden flex items-center justify-center">
                      <img
                        v-if="player.avatar_url"
                        :src="player.avatar_url"
                        :alt="player.nickname"
                        class="object-cover w-full h-full"
                        @error="($event.target as HTMLImageElement).style.display = 'none'"
                      />
                      <span v-else class="text-sm font-bold text-base-content/60">
                        {{ (player.real_name || player.nickname || '?').charAt(0) }}
                      </span>
                    </div>
                  </div>
                  <div class="min-w-0">
                    <p class="whitespace-nowrap text-sm font-semibold leading-snug">
                      {{ player.real_name || player.nickname || '-' }}
                    </p>
                    <p
                      v-if="player.real_name && player.nickname && player.real_name !== player.nickname"
                      class="text-xs text-base-content/50 leading-snug break-all"
                    >
                      @{{ player.nickname }}
                    </p>
                    <p class="text-xs text-base-content/40 leading-snug whitespace-nowrap">
                      ID: {{ player.id }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="min-w-[140px]">
                <span class="whitespace-nowrap text-sm font-mono">{{ player.phone_number || '-' }}</span>
              </td>
              <td class="min-w-[180px]">
                <div v-if="player.teams.length > 0" class="flex flex-wrap gap-1 max-w-[220px]">
                  <span
                    v-for="team in player.teams"
                    :key="team.team_id"
                    class="badge badge-sm gap-1"
                    :class="team.role === 'captain' ? 'badge-warning' : team.role === 'leader' ? 'badge-info' : 'badge-ghost'"
                    :title="roleLabel(team.role)"
                  >
                    {{ team.team_name }}
                  </span>
                </div>
                <span v-else class="text-xs text-base-content/40">自由球员</span>
              </td>
              <td class="min-w-[130px]">
                <span class="whitespace-nowrap text-xs text-base-content/60">{{
                  formatPlayerDate(player.latest_login_date)
                }}</span>
              </td>
              <td class="min-w-[130px]">
                <span class="whitespace-nowrap text-xs text-base-content/60">{{
                  formatPlayerDate(player.create_time)
                }}</span>
              </td>
              <td class="min-w-[140px]">
                <div class="flex min-w-[120px] flex-col gap-1">
                  <span class="badge badge-sm" :class="player.status === 1 ? 'badge-success' : 'badge-error'">
                    {{ player.status === 1 ? '正常' : '冻结' }}
                  </span>
                  <template v-if="player.status === 0 && player.freeze_start_time">
                    <span class="whitespace-nowrap text-xs leading-tight text-base-content/50">
                      {{ formatPlayerDate(player.freeze_start_time) }}
                      <template v-if="player.freeze_end_time">
                        ~ {{ formatPlayerDate(player.freeze_end_time) }}
                      </template>
                      <template v-else> 起</template>
                    </span>
                  </template>
                </div>
              </td>
              <td class="min-w-[170px] whitespace-nowrap text-right">
                <div class="flex flex-nowrap justify-end gap-1">
                  <button class="btn btn-xs btn-outline" @click="emit('edit', player)">编辑</button>
                  <button
                    v-if="player.status === 1"
                    class="btn btn-xs btn-warning btn-outline"
                    @click="emit('freeze', player)"
                  >
                    冻结
                  </button>
                  <button
                    v-else
                    class="btn btn-xs btn-success btn-outline"
                    @click="emit('unfreeze', player)"
                  >
                    解冻
                  </button>
                  <button class="btn btn-xs btn-error btn-outline" @click="emit('delete', player)">
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="showOverlayLoading"
      class="pointer-events-none absolute inset-0 z-10 flex items-start justify-end bg-base-100/55 p-4 backdrop-blur-[1px]"
    >
      <div
        class="inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-100/95 px-3 py-1.5 text-sm text-base-content/70 shadow-sm"
      >
        <span class="loading loading-spinner loading-sm text-primary"></span>
        正在刷新排序结果
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, h } from 'vue'
import type { Player } from '@/services/player'
import { formatPlayerDate, roleLabel } from './player-list.model'

defineProps<{
  players: Player[]
  loading: boolean
  loadError: string
  showInitialLoading: boolean
  showOverlayLoading: boolean
  selectedPlayerIds: number[]
  allPlayersSelected: boolean
  sortBy: string | undefined
  sortOrder: string | undefined
}>()

const emit = defineEmits<{
  retry: []
  clearSelection: []
  batchDelete: []
  toggleSelectAll: []
  togglePlayer: [id: number]
  sort: [field: string]
  edit: [player: Player]
  freeze: [player: Player]
  unfreeze: [player: Player]
  delete: [player: Player]
}>()

const SortButton = defineComponent({
  props: {
    label: { type: String, required: true },
    field: { type: String, required: true },
    sortBy: { type: String, required: false },
    sortOrder: { type: String, required: false },
  },
  emits: ['sort'],
  setup(props, { emit }) {
    const iconPath = () => {
      if (props.sortBy !== props.field) return ['m8 9 4-4 4 4', 'm8 15 4 4 4-4']
      return props.sortOrder === 'asc' ? ['M12 18V6', 'm7 11 5-5 5 5'] : ['M12 6v12', 'm17 13-5 5-5-5']
    }

    return () =>
      h(
        'button',
        {
          class:
            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all ' +
            (props.sortBy === props.field
              ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
              : 'border-transparent bg-base-200/70 text-base-content/65 hover:border-base-300 hover:bg-base-200 hover:text-base-content'),
          onClick: () => emit('sort', props.field),
        },
        [
          h('span', props.label),
          h(
            'span',
            {
              class:
                'inline-flex h-6 w-6 items-center justify-center rounded-full border transition-all ' +
                (props.sortBy === props.field
                  ? 'border-primary/30 bg-primary text-primary-content'
                  : 'border-base-300 bg-base-100 text-base-content/45'),
            },
            [
              h(
                'svg',
                {
                  xmlns: 'http://www.w3.org/2000/svg',
                  class: 'h-3.5 w-3.5',
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  'stroke-width': props.sortBy === props.field ? '2.6' : '2.2',
                  'stroke-linecap': 'round',
                  'stroke-linejoin': 'round',
                },
                iconPath().map((d) => h('path', { d })),
              ),
            ],
          ),
        ],
      )
  },
})
</script>
