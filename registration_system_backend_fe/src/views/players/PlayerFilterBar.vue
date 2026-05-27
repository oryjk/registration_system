<template>
  <section class="sticky top-16 z-10 -mx-4 flex flex-col gap-4 bg-base-200 px-4 pb-4 pt-4 lg:-mx-6 lg:px-6">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-bold">用户管理</h2>
        <p class="mt-0.5 text-sm text-base-content/60">
          管理平台注册用户，包含小程序注册、手动录入、球队成员和自由用户
        </p>
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
        新建用户
      </button>
    </div>

    <div class="card border border-base-300 bg-base-100 shadow-sm">
      <div class="card-body p-4">
        <div class="flex flex-wrap items-end gap-3">
          <label class="flex min-w-[200px] flex-1 flex-col gap-1">
            <span class="text-xs font-semibold text-base-content/60">搜索用户</span>
            <label class="input input-bordered flex h-10 items-center gap-2 border-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 text-base-content/40"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
                />
              </svg>
              <input
                v-model="filters.keyword"
                type="text"
                class="grow bg-transparent text-sm outline-none"
                placeholder="昵称、真实姓名、手机号"
                @keyup.enter="emit('search')"
              />
            </label>
          </label>

          <label class="flex w-32 flex-col gap-1">
            <span class="text-xs font-semibold text-base-content/60">状态</span>
            <select v-model="filters.status" class="select select-bordered h-10 border-2 text-sm">
              <option :value="undefined">全部</option>
              <option :value="1">正常</option>
              <option :value="0">冻结</option>
            </select>
          </label>

          <label class="flex w-36 flex-col gap-1">
            <span class="text-xs font-semibold text-base-content/60">球队状态</span>
            <select v-model="filters.has_team" class="select select-bordered h-10 border-2 text-sm">
              <option :value="undefined">全部</option>
              <option :value="true">已加入球队</option>
              <option :value="false">未加入球队</option>
            </select>
          </label>

          <div class="flex gap-2">
            <button class="btn btn-primary h-10 min-h-0 px-5" @click="emit('search')">搜索</button>
            <button class="btn btn-ghost h-10 min-h-0 px-4" @click="emit('reset')">重置</button>
          </div>

          <div class="ml-auto flex items-center gap-2">
            <span class="text-sm text-base-content/50">
              共 <strong class="text-base-content">{{ total }}</strong> 位用户
            </span>
          </div>
        </div>

        <div
          v-if="!loadError && total > 0"
          class="mt-4 rounded-xl border border-base-300 bg-base-100 px-4 py-3 shadow-sm"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-base-content/60">
              第 <strong class="text-base-content">{{ currentPage }}</strong> /
              {{ totalPages }} 页，共
              <strong class="text-base-content">{{ total }}</strong> 条记录
            </p>
            <div class="join">
              <button
                class="join-item btn btn-sm"
                :disabled="loading || currentPage <= 1"
                @click="emit('page', currentPage - 1)"
              >
                «
              </button>
              <button
                v-for="page in pageNumbers"
                :key="page"
                class="join-item btn btn-sm"
                :disabled="loading"
                :class="page === currentPage ? 'btn-active btn-primary' : ''"
                @click="emit('page', page)"
              >
                {{ page }}
              </button>
              <button
                class="join-item btn btn-sm"
                :disabled="loading || currentPage >= totalPages"
                @click="emit('page', currentPage + 1)"
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PlayerFilters } from './player-list.model'

defineProps<{
  filters: PlayerFilters
  total: number
  currentPage: number
  totalPages: number
  pageNumbers: number[]
  loading: boolean
  loadError: string
}>()

const emit = defineEmits<{
  create: []
  search: []
  reset: []
  page: [page: number]
}>()
</script>
