<template>
  <div class="card bg-base-100 border border-base-300 shadow-sm">
    <div class="card-body p-5">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h3 class="font-bold text-base">到场签到</h3>
          <p class="mt-1 text-sm text-base-content/55">按球队维度展示本场定位签到配置</p>
        </div>
        <span class="badge badge-outline">{{ activity.team_checkin_configs.length }} 条配置</span>
      </div>

      <div
        v-if="teamIds.length === 0"
        class="mt-4 rounded-2xl border border-dashed border-base-300 p-6 text-center text-sm text-base-content/55"
      >
        当前活动还没有设置主队或客队，暂不能配置球队签到。
      </div>

      <div v-else class="mt-4 grid gap-3 md:grid-cols-2">
        <div
          v-for="teamId in teamIds"
          :key="teamId"
          class="rounded-2xl border border-base-300 bg-base-200/40 p-4"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ teamLabel(teamId) }}</p>
              <p class="mt-1 text-xs text-base-content/50 font-mono">{{ teamId }}</p>
            </div>
            <span class="badge" :class="teamConfig(teamId)?.enabled ? 'badge-success' : 'badge-ghost'">
              {{ teamConfig(teamId)?.enabled ? '已启用' : '未启用' }}
            </span>
          </div>

          <template v-if="teamConfig(teamId)">
            <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-base-content/50">签到半径</p>
                <p class="mt-1 font-semibold">{{ teamConfig(teamId)?.radius_meters }} 米</p>
              </div>
              <div>
                <p class="text-base-content/50">开放窗口</p>
                <p class="mt-1 font-semibold">
                  提前 {{ teamConfig(teamId)?.open_minutes_before }} 分钟 / 延后
                  {{ teamConfig(teamId)?.close_minutes_after }} 分钟
                </p>
              </div>
              <div class="col-span-2">
                <p class="text-base-content/50">实际时间</p>
                <p class="mt-1 font-semibold">
                  {{ formatDateTime(teamConfig(teamId)?.checkin_open_at || '') }} -
                  {{ formatDateTime(teamConfig(teamId)?.checkin_close_at || '') }}
                </p>
              </div>
            </div>
          </template>
          <p v-else class="mt-4 text-sm text-base-content/55">该队本场还没有开启签到。</p>

          <div class="mt-4 border-t border-base-300/70 pt-4">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                class="flex items-center justify-between gap-3 rounded-xl bg-base-100 px-3 py-2"
              >
                <span class="text-sm font-medium">启用签到</span>
                <input
                  v-model="checkinForm(teamId).enabled"
                  type="checkbox"
                  class="toggle toggle-primary toggle-sm"
                />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-base-content/55">签到半径（米）</span>
                <input
                  v-model.number="checkinForm(teamId).radius_meters"
                  type="number"
                  min="20"
                  max="1000"
                  class="input input-bordered h-10"
                />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-base-content/55">提前开放（分钟）</span>
                <input
                  v-model.number="checkinForm(teamId).open_minutes_before"
                  type="number"
                  min="0"
                  max="1440"
                  class="input input-bordered h-10"
                />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-base-content/55">延后关闭（分钟）</span>
                <input
                  v-model.number="checkinForm(teamId).close_minutes_after"
                  type="number"
                  min="0"
                  max="1440"
                  class="input input-bordered h-10"
                />
              </label>
            </div>
            <div class="mt-3 flex justify-end">
              <button
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="savingTeamId === teamId"
                @click="saveTeamConfig(teamId)"
              >
                <span
                  v-if="savingTeamId === teamId"
                  class="loading loading-spinner loading-xs"
                ></span>
                保存配置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { Activity, ActivityTeamCheckinConfig } from '@/services/activity'
import { formatDateTime } from './activity-detail.model'

const props = defineProps<{
  activity: Activity
  teamIds: number[]
  savingTeamId?: number | null
}>()

const emit = defineEmits<{
  save: [
    payload: {
      team_id: number
      enabled: boolean
      radius_meters: number
      open_minutes_before: number
      close_minutes_after: number
    },
  ]
}>()

type CheckinConfigForm = {
  enabled: boolean
  radius_meters: number
  open_minutes_before: number
  close_minutes_after: number
}

const defaultForm = (): CheckinConfigForm => ({
  enabled: false,
  radius_meters: 150,
  open_minutes_before: 60,
  close_minutes_after: 30,
})

const forms = reactive<Record<number, CheckinConfigForm>>({})

const checkinForm = (teamId: number) => {
  forms[teamId] ??= defaultForm()
  return forms[teamId]
}

const teamConfig = (teamId: number): ActivityTeamCheckinConfig | null =>
  props.activity.team_checkin_configs.find((item) => item.team_id === teamId) ?? null

const teamLabel = (teamId: number) => {
  if (teamId === props.activity.home_team_id) return '主队签到'
  if (teamId === props.activity.away_team_id) return '客队签到'
  return '球队签到'
}

const syncForms = () => {
  props.teamIds.forEach((teamId) => {
    const config = teamConfig(teamId)
    forms[teamId] = config
      ? {
          enabled: config.enabled,
          radius_meters: config.radius_meters,
          open_minutes_before: config.open_minutes_before,
          close_minutes_after: config.close_minutes_after,
        }
      : defaultForm()
  })
}

const saveTeamConfig = (teamId: number) => {
  const form = forms[teamId] ?? defaultForm()
  emit('save', {
    team_id: teamId,
    enabled: form.enabled,
    radius_meters: form.radius_meters,
    open_minutes_before: form.open_minutes_before,
    close_minutes_after: form.close_minutes_after,
  })
}

watch(
  () => [props.activity.id, props.activity.team_checkin_configs, props.teamIds] as const,
  syncForms,
  { immediate: true, deep: true },
)
</script>
