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

      <div class="mt-4 grid gap-3 md:grid-cols-2">
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Activity, ActivityTeamCheckinConfig } from '@/services/activity'
import { formatDateTime } from './activity-detail.model'

const props = defineProps<{
  activity: Activity
  teamIds: number[]
}>()

const teamConfig = (teamId: number): ActivityTeamCheckinConfig | null =>
  props.activity.team_checkin_configs.find((item) => item.team_id === teamId) ?? null

const teamLabel = (teamId: number) => {
  if (teamId === props.activity.home_team_id) return '主队签到'
  if (teamId === props.activity.away_team_id) return '客队签到'
  return '球队签到'
}
</script>
