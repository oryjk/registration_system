<template>
  <div class="card bg-base-100 border border-base-300 shadow-sm">
    <div class="card-body p-5">
      <section class="sticky top-16 z-10 -mx-5 mb-4 flex flex-col gap-4 bg-base-100 px-5 pb-4 pt-5">
        <div class="flex items-center justify-between gap-4">
          <h3 class="font-bold text-base">报名记录</h3>
          <button class="btn btn-primary btn-sm gap-1" @click="emit('openRegister')">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            手动报名
          </button>
        </div>

        <div
          v-if="selectedRegIds.length > 0"
          class="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10"
        >
          <span class="text-sm"
            >已选 <strong>{{ selectedRegIds.length }}</strong> 人</span
          >
          <div class="flex-1"></div>
          <button class="btn btn-sm btn-ghost" @click="emit('clearSelection')">清空</button>
          <button class="btn btn-sm btn-primary gap-1" @click="emit('openBatchStand')">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9h-2V7h2v5zm0 4h-2v-2h2v2z"
              />
            </svg>
            批量修改状态
          </button>
        </div>

        <div class="rounded-xl border border-base-300 bg-base-100 px-4 py-3 shadow-sm">
          <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="option in filterOptions"
                :key="option.value"
                class="btn btn-xs"
                :class="regFilter === option.value ? 'btn-primary' : 'btn-outline'"
                @click="emit('filter', option.value)"
              >
                {{ option.label }} ({{ filterTabCount(option.value) }})
              </button>
            </div>

            <div class="flex flex-wrap items-center gap-3 xl:justify-end">
              <p v-if="regTotal > 0" class="text-sm text-base-content/60">
                第 <strong class="text-base-content">{{ regPage }}</strong> /
                {{ regTotalPages }} 页，共
                <strong class="text-base-content">{{ regTotal }}</strong> 条
              </p>
              <div v-if="regTotal > 0" class="join">
                <button
                  type="button"
                  class="join-item btn btn-sm"
                  :disabled="regPage <= 1 || regLoading"
                  @click="emit('page', regPage - 1)"
                >
                  上一页
                </button>
                <button
                  type="button"
                  class="join-item btn btn-sm"
                  :disabled="regPage >= regTotalPages || regLoading"
                  @click="emit('page', regPage + 1)"
                >
                  下一页
                </button>
              </div>
              <label class="ml-auto flex items-center gap-2 text-xs text-base-content/60 xl:ml-0">
                <span>每页</span>
                <select
                  :value="regPageSize"
                  class="select select-bordered select-xs h-8 min-h-0 w-[5.5rem]"
                  @change="emit('pageSize', Number(($event.target as HTMLSelectElement).value))"
                >
                  <option :value="10">10</option>
                  <option :value="20">20</option>
                  <option :value="50">50</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </section>

      <div v-if="regLoading" class="flex justify-center py-8">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>

      <div v-else-if="regItems.length === 0" class="text-center text-base-content/40 py-8 text-sm">
        暂无报名记录
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table table-zebra table-sm min-w-[880px]">
          <thead>
            <tr>
              <th class="w-10">
                <label class="flex justify-center">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    :checked="allPageSelected"
                    @change="emit('toggleSelectAll')"
                  />
                </label>
              </th>
              <th class="min-w-[14rem]">球员</th>
              <th class="min-w-[9rem]">手机号</th>
              <th class="min-w-[6rem]">状态</th>
              <th class="min-w-[10rem]">签到</th>
              <th class="min-w-[6rem]">报名次数</th>
              <th class="min-w-[8rem]">操作时间</th>
              <th class="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="reg in regItems" :key="reg.user_id">
              <td>
                <label class="flex justify-center">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    :checked="selectedRegIds.includes(reg.user_id)"
                    @change="emit('toggleReg', reg.user_id)"
                  />
                </label>
              </td>
              <td>
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-base-300">
                    <img
                      v-if="reg.avatar_url"
                      :src="reg.avatar_url"
                      class="w-full h-full object-cover"
                      @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <span class="text-sm font-bold">{{
                        (reg.real_name || reg.nickname || '?').charAt(0)
                      }}</span>
                    </div>
                  </div>
                  <div>
                    <p class="font-semibold text-sm leading-none">
                      {{ reg.real_name || reg.nickname }}
                    </p>
                    <p
                      v-if="reg.real_name && reg.nickname !== reg.real_name"
                      class="text-xs text-base-content/50 mt-0.5"
                    >
                      @{{ reg.nickname }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="whitespace-nowrap text-sm font-mono text-base-content/60">
                {{ reg.phone_number || '-' }}
              </td>
              <td>
                <span
                  class="badge badge-sm min-w-[3.75rem] justify-center whitespace-nowrap"
                  :class="STAND_BADGE[reg.stand] || 'badge-ghost'"
                >
                  {{ reg.stand_label }}
                </span>
              </td>
              <td class="whitespace-nowrap text-xs text-base-content/60">
                <template v-if="reg.checked_in_at">
                  <span class="badge badge-success badge-sm">已签到</span>
                  <span class="ml-2">{{ formatDateTime(reg.checked_in_at) }}</span>
                  <span v-if="reg.checkin_distance_meters != null" class="ml-2">
                    · {{ reg.checkin_distance_meters }} 米
                  </span>
                </template>
                <span v-else>未签到</span>
              </td>
              <td class="whitespace-nowrap text-sm">{{ reg.registration_count }}</td>
              <td class="whitespace-nowrap text-xs text-base-content/50">
                {{ formatDateTime(reg.operation_time) }}
              </td>
              <td class="text-right">
                <div class="flex flex-nowrap gap-1 justify-end">
                  <div class="dropdown dropdown-end">
                    <button tabindex="0" class="btn btn-xs btn-outline whitespace-nowrap">
                      更改状态
                    </button>
                    <ul
                      tabindex="0"
                      class="dropdown-content menu menu-sm bg-base-100 rounded-box z-50 w-28 p-1 shadow-lg border border-base-200"
                    >
                      <li v-if="reg.stand !== 1">
                        <a @click="emit('changeStatus', reg.user_id, 1)">参加</a>
                      </li>
                      <li v-if="reg.stand !== 2">
                        <a @click="emit('changeStatus', reg.user_id, 2)">请假</a>
                      </li>
                      <li v-if="reg.stand !== 3">
                        <a @click="emit('changeStatus', reg.user_id, 3)">迟到</a>
                      </li>
                    </ul>
                  </div>
                  <button
                    class="btn btn-xs btn-error btn-outline whitespace-nowrap"
                    @click="emit('cancel', reg)"
                  >
                    取消报名
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
import {
  STAND_BADGE,
  type RegistrationStandCounts,
  type RegistrationWithInfo,
} from '@/services/activity'
import { formatDateTime } from './activity-detail.model'

const props = defineProps<{
  regItems: RegistrationWithInfo[]
  regCounts: RegistrationStandCounts
  regTotal: number
  regPage: number
  regPageSize: number
  regTotalPages: number
  regFilter: number
  regLoading: boolean
  selectedRegIds: number[]
  allPageSelected: boolean
}>()

const filterOptions = [
  { value: -1, label: '全部' },
  { value: 1, label: '参加' },
  { value: 2, label: '请假' },
  { value: 3, label: '迟到' },
  { value: 0, label: '未表态' },
]

const filterTabCount = (stand: number) => {
  if (stand === -1) return props.regCounts.total
  if (stand === 0) return props.regCounts.unknown
  if (stand === 1) return props.regCounts.attending
  if (stand === 2) return props.regCounts.leave
  if (stand === 3) return props.regCounts.absent
  return 0
}

const emit = defineEmits<{
  openRegister: []
  openBatchStand: []
  clearSelection: []
  filter: [stand: number]
  page: [page: number]
  pageSize: [pageSize: number]
  toggleSelectAll: []
  toggleReg: [userId: number]
  changeStatus: [userId: number, stand: number]
  cancel: [registration: RegistrationWithInfo]
}>()
</script>
