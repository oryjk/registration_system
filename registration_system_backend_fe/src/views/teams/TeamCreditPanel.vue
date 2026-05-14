<template>
  <div class="card bg-base-100 border border-base-300 shadow-sm">
    <div class="card-body p-5">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="font-bold text-base">球队信用</h3>
          <p class="text-xs text-base-content/50 mt-0.5">
            赛后互评、会员修复和后台罚扣都会写入信用流水。
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="badge" :class="detail.team.is_vip ? 'badge-warning' : 'badge-ghost'">
            {{ detail.team.is_vip ? '会员中' : '普通队' }}
          </span>
          <span class="badge badge-outline">{{ detail.team.trust_label }}</span>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <div class="rounded-2xl bg-base-200 p-4">
          <div class="text-xs text-base-content/50">当前信用</div>
          <div class="text-3xl font-black mt-1">{{ detail.team.credit_score }}</div>
        </div>
        <div class="rounded-2xl bg-base-200 p-4">
          <div class="text-xs text-base-content/50">信用标签</div>
          <div class="text-base font-semibold mt-1">{{ detail.team.trust_label }}</div>
        </div>
        <div class="rounded-2xl bg-base-200 p-4">
          <div class="text-xs text-base-content/50">会员到期</div>
          <div class="text-base font-semibold mt-1">{{ formatDateTime(detail.team.vip_until) }}</div>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 mt-4">
        <button
          class="btn btn-sm btn-outline btn-error"
          :disabled="applyingCreditPenalty"
          @click="emit('penalty', 5)"
        >
          罚扣 5 分
        </button>
        <button
          class="btn btn-sm btn-outline btn-error"
          :disabled="applyingCreditPenalty"
          @click="emit('penalty', 10)"
        >
          罚扣 10 分
        </button>
        <button
          class="btn btn-sm btn-outline btn-error"
          :disabled="applyingCreditPenalty"
          @click="emit('penalty', 20)"
        >
          罚扣 20 分
        </button>
      </div>

      <div class="overflow-x-auto mt-4">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>时间</th>
              <th>类型</th>
              <th>变化</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!creditTransactions.length">
              <td colspan="4" class="text-center text-base-content/50 py-4">暂无信用流水</td>
            </tr>
            <tr v-for="item in creditTransactions" :key="item.id">
              <td class="whitespace-nowrap">{{ formatDateTime(item.created_at) }}</td>
              <td>{{ transactionTypeLabel(item.transaction_type) }}</td>
              <td>
                <span
                  :class="
                    item.delta >= 0 ? 'text-success font-semibold' : 'text-error font-semibold'
                  "
                >
                  {{ item.delta >= 0 ? `+${item.delta}` : item.delta }}
                </span>
                <span class="text-xs text-base-content/50 ml-2">
                  {{ item.score_before }} -> {{ item.score_after }}
                </span>
              </td>
              <td>{{ item.note || '系统记录' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TeamCreditTransaction, TeamDetailForAdmin } from '@/services/team'
import { formatDateTime, transactionTypeLabel } from './team-detail.model'

defineProps<{
  detail: TeamDetailForAdmin
  creditTransactions: TeamCreditTransaction[]
  applyingCreditPenalty: boolean
}>()

const emit = defineEmits<{
  penalty: [points: number]
}>()
</script>
