<template>
  <section class="sticky top-16 z-10 -mx-4 flex flex-col gap-4 bg-base-200 px-4 pb-3 pt-4 lg:-mx-6 lg:px-6">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-bold">比赛报名</h2>
        <p class="mt-0.5 text-sm text-base-content/60">管理比赛，查看和操作球员报名状态</p>
      </div>
      <button class="btn btn-primary gap-2" @click="emit('create')">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
        新建比赛
      </button>
    </div>

    <ActivityStatusSummary :counts="counts" />

    <div class="rounded-xl border border-base-300 bg-base-100 px-4 py-3 shadow-sm">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in ACTIVITY_STATUS_FILTERS"
            :key="option.value"
            class="btn btn-sm"
            :class="filterStatus === option.value ? 'btn-primary' : 'btn-outline'"
            @click="emit('filter', option.value)"
          >
            {{ option.label }} ({{ activityFilterTabCount(counts, option.value) }})
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-3 xl:justify-end">
          <p v-if="listTotal > 0" class="text-sm text-base-content/60">
            第 <strong class="text-base-content">{{ listPage }}</strong> /
            {{ listTotalPages }} 页，共
            <strong class="text-base-content">{{ listTotal }}</strong> 场
          </p>
          <div v-if="listTotal > 0" class="join">
            <button
              type="button"
              class="join-item btn btn-sm"
              :disabled="listPage <= 1 || loading"
              @click="emit('page', listPage - 1)"
            >
              上一页
            </button>
            <button
              type="button"
              class="join-item btn btn-sm"
              :disabled="listPage >= listTotalPages || loading"
              @click="emit('page', listPage + 1)"
            >
              下一页
            </button>
          </div>
          <label class="ml-auto flex items-center gap-2 text-xs text-base-content/60 xl:ml-0">
            <span>每页</span>
            <select
              :value="listPageSize"
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
</template>

<script setup lang="ts">
import type { ActivityStatusCounts } from '@/services/activity'
import ActivityStatusSummary from './ActivityStatusSummary.vue'
import { ACTIVITY_STATUS_FILTERS, activityFilterTabCount } from './activity-list.model'

defineProps<{
  counts: ActivityStatusCounts
  filterStatus: number
  listTotal: number
  listPage: number
  listPageSize: number
  listTotalPages: number
  loading: boolean
}>()

const emit = defineEmits<{
  create: []
  filter: [status: number]
  page: [page: number]
  pageSize: [pageSize: number]
}>()
</script>
