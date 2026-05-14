<template>
  <div class="card bg-base-100 border border-base-300 shadow-sm">
    <div class="card-body p-5">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-xl font-bold">{{ activity.name }}</h2>
            <span class="badge" :class="STATUS_BADGE[activity.status] || 'badge-ghost'">
              {{ STATUS_LABEL[activity.status] || activity.status }}
            </span>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-base-content/60">
            <span class="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"
                />
              </svg>
              {{ formatDateTime(activity.holding_date) }}
            </span>
            <span class="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                />
              </svg>
              {{ activity.location }}
            </span>
            <span v-if="activity.opposing" class="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"
                />
              </svg>
              对阵：{{ activity.opposing }}
            </span>
            <span class="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
                />
              </svg>
              报名时段：{{ formatTime(activity.start_time) }} -
              {{ formatTime(activity.end_time) }}
            </span>
          </div>
          <p v-if="activity.description" class="mt-2 text-sm text-base-content/60">
            {{ activity.description }}
          </p>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <button class="btn btn-sm btn-outline gap-1" @click="emit('edit')">
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
      </div>

      <div class="flex flex-wrap gap-4 mt-4 pt-4 border-t border-base-200">
        <div class="flex items-center gap-1.5 text-sm">
          <span class="badge badge-success badge-sm">参加</span>
          <strong>{{ regCounts.attending }}</strong> 人
        </div>
        <div class="flex items-center gap-1.5 text-sm">
          <span class="badge badge-warning badge-sm">请假</span>
          <strong>{{ regCounts.leave }}</strong> 人
        </div>
        <div class="flex items-center gap-1.5 text-sm">
          <span class="badge badge-error badge-sm">迟到</span>
          <strong>{{ regCounts.absent }}</strong> 人
        </div>
        <div class="flex items-center gap-1.5 text-sm">
          <span class="badge badge-ghost badge-sm">未表态</span>
          <strong>{{ regCounts.unknown }}</strong> 人
        </div>
        <div class="flex items-center gap-1.5 text-sm ml-auto text-base-content/50">
          共 <strong class="text-base-content">{{ regCounts.total }}</strong> 条报名记录
          <span v-if="activity.players_per_team">（上限 {{ activity.players_per_team }} 人/队）</span>
        </div>
      </div>

      <div
        v-if="registrationProgress"
        class="mt-4 rounded-2xl border border-base-300 bg-base-200/50 p-4"
      >
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">报名人数进度</p>
            <p class="mt-1 text-xs text-base-content/55">
              参加 {{ regCounts.attending }} 人，{{ registrationProgress.matchFormat }} 人制达标点
              {{ registrationProgress.requiredCount }} 人， 每队上限
              {{ registrationProgress.upperLimit }} 人
            </p>
          </div>
          <div class="text-right">
            <p
              class="text-2xl font-black tabular-nums"
              :class="registrationProgress.reachedRequirement ? 'text-success' : 'text-error'"
            >
              {{ registrationProgress.displayPercent }}%
            </p>
            <p class="text-xs text-base-content/55">
              {{ registrationProgress.reachedRequirement ? '已达到人制要求' : '未达到人制要求' }}
            </p>
          </div>
        </div>

        <div class="mt-4">
          <div class="relative h-3 overflow-hidden rounded-full bg-base-300/90">
            <div
              class="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
              :class="registrationProgress.reachedRequirement ? 'bg-success' : 'bg-error'"
              :style="{ width: `${registrationProgress.fillWidth}%` }"
            ></div>
            <div
              class="absolute top-1/2 z-10 h-5 w-5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white bg-base-100 shadow-sm"
              :style="{ left: `${registrationProgress.requiredMarker}%` }"
              :title="`${registrationProgress.matchFormat} 人制达标点`"
            ></div>
            <div
              class="absolute top-1/2 right-0 z-10 h-5 w-5 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-white bg-base-100 shadow-sm"
              title="人数上限"
            ></div>
          </div>
          <div class="relative mt-2 h-10 text-[11px] font-medium text-base-content/60">
            <div
              class="absolute top-0 -translate-x-1/2 text-center"
              :style="{ left: `${registrationProgress.requiredMarker}%` }"
            >
              <p>{{ registrationProgress.requiredCount }} 人</p>
              <p>{{ registrationProgress.matchFormat }} 人制</p>
            </div>
            <div class="absolute top-0 right-0 translate-x-1/2 text-center">
              <p>{{ registrationProgress.upperLimit }} 人</p>
              <p>上限</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { STATUS_BADGE, STATUS_LABEL, type Activity, type RegistrationStandCounts } from '@/services/activity'
import { formatDateTime, formatTime } from './activity-detail.model'

defineProps<{
  activity: Activity
  regCounts: RegistrationStandCounts
  registrationProgress: ReturnType<typeof import('./activity-detail.model').buildRegistrationProgress>
}>()

const emit = defineEmits<{
  edit: []
}>()
</script>
