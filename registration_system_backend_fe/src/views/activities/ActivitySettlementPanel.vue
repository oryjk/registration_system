<script setup lang="ts">
import type { ActivitySettlementSummary } from '@/services/billing'
import type { Player } from '@/services/player'
import {
  formatSettlementCurrency,
  playerName,
  settlementModeLabel,
  settlementScopeLabel,
  type SettlementFormState,
} from './settlement.model'

defineProps<{
  summary: ActivitySettlementSummary | null
  form: SettlementFormState
  activityEnded: boolean
  loading: boolean
  submitting: boolean
  error: string
  attendingUserCount: number
  searchKeyword: string
  searchResults: Player[]
  searching: boolean
  playerById: Record<number, Player>
}>()

const emit = defineEmits<{
  (event: 'update:searchKeyword', value: string): void
  (event: 'modeChange'): void
  (event: 'scopeChange'): void
  (event: 'searchPlayers'): void
  (event: 'addCustomPlayer', player: Player): void
  (event: 'removeCustomPlayer', userId: number): void
  (event: 'submit'): void
}>()
</script>

<template>
  <div class="card bg-base-100 border border-base-300 shadow-sm">
    <div class="card-body p-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 class="font-bold text-base">赛后费用结算</h3>
          <p class="mt-1 text-sm text-base-content/55">
            支持参加名单 AA、自定义人员 AA，以及手动指定每人金额。
          </p>
        </div>
        <span class="badge" :class="summary?.settled ? 'badge-success' : 'badge-ghost'">
          {{ summary?.settled ? '已结算' : '未结算' }}
        </span>
      </div>

      <div v-if="error" class="alert alert-error mt-4 py-2 text-sm">{{ error }}</div>
      <div v-if="loading" class="flex justify-center py-8">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>

      <template v-else>
        <div class="mt-4 grid gap-4 xl:grid-cols-[1fr,1fr]">
          <section class="rounded-2xl border border-base-300 bg-base-200/40 p-4">
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <p class="text-sm text-base-content/50">参加人数</p>
                <p class="mt-1 text-2xl font-black tabular-nums">{{ attendingUserCount }}</p>
              </div>
              <div>
                <p class="text-sm text-base-content/50">已扣费人数</p>
                <p class="mt-1 text-2xl font-black tabular-nums">
                  {{ summary?.settled_user_count ?? 0 }}
                </p>
              </div>
              <div>
                <p class="text-sm text-base-content/50">当前批次</p>
                <p class="mt-1 text-lg font-bold">
                  {{ summary?.current_batch_no ? `第 ${summary.current_batch_no} 批` : '—' }}
                </p>
              </div>
              <div>
                <p class="text-sm text-base-content/50">结算总金额</p>
                <p class="mt-1 text-lg font-bold">
                  {{ formatSettlementCurrency(summary?.total_amount) }}
                </p>
              </div>
              <div>
                <p class="text-sm text-base-content/50">人均费用</p>
                <p class="mt-1 text-lg font-bold">
                  {{ formatSettlementCurrency(summary?.aa_fee) }}
                </p>
              </div>
              <div>
                <p class="text-sm text-base-content/50">扣费方式</p>
                <p class="mt-1 text-sm font-bold">
                  {{ settlementModeLabel(summary?.mode) }} · {{ settlementScopeLabel(summary?.participant_scope) }}
                </p>
              </div>
            </div>

            <div class="mt-4 rounded-xl border border-dashed border-base-300 bg-base-100/70 p-3">
              <p class="text-sm text-base-content/50">结算说明</p>
              <p class="mt-1 text-sm">
                {{ summary?.description || '未填写说明。' }}
              </p>
            </div>

            <div v-if="summary?.items?.length" class="mt-4 overflow-hidden rounded-xl border border-base-300">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>人员</th>
                    <th class="text-right">金额</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in summary.items" :key="item.user_id">
                    <td>{{ item.user_name || `用户 ${item.user_id}` }}</td>
                    <td class="text-right font-mono">{{ formatSettlementCurrency(item.fee) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <form class="rounded-2xl border border-base-300 bg-base-200/40 p-4" @submit.prevent="emit('submit')">
            <div class="flex items-center justify-between gap-3">
              <h4 class="font-semibold">触发结算</h4>
              <span class="text-xs text-base-content/50">
                {{ activityEnded ? '活动已结束，可执行结算' : '仅已结束活动可结算' }}
              </span>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1.5 sm:col-span-2">
                <span class="text-sm font-semibold">总金额</span>
                <input
                  v-model="form.totalAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="例如 240"
                  class="input input-bordered border-2 h-11"
                  :disabled="submitting"
                />
              </label>

              <label class="flex flex-col gap-1.5">
                <span class="text-sm font-semibold">扣费方式</span>
                <select
                  v-model="form.mode"
                  class="select select-bordered border-2 h-11"
                  :disabled="submitting"
                  @change="emit('modeChange')"
                >
                  <option value="aa">AA 平摊</option>
                  <option value="manual">手动金额</option>
                </select>
              </label>

              <label class="flex flex-col gap-1.5">
                <span class="text-sm font-semibold">扣费人员</span>
                <select
                  v-model="form.participantScope"
                  class="select select-bordered border-2 h-11"
                  :disabled="submitting"
                  @change="emit('scopeChange')"
                >
                  <option value="registered_attendees">参加名单</option>
                  <option value="custom_users">自定义人员</option>
                </select>
              </label>

              <label class="flex flex-col gap-1.5 sm:col-span-2">
                <span class="text-sm font-semibold">结算说明</span>
                <textarea
                  v-model="form.description"
                  rows="2"
                  class="textarea textarea-bordered border-2 resize-none"
                  placeholder="例如：场地费 + 裁判费"
                  :disabled="submitting"
                ></textarea>
              </label>
            </div>

            <div v-if="form.participantScope === 'custom_users'" class="mt-4 rounded-xl bg-base-100/80 p-3">
              <div class="flex gap-2">
                <input
                  :value="searchKeyword"
                  class="input input-bordered h-10 flex-1"
                  placeholder="搜索姓名、昵称或手机号"
                  @input="emit('update:searchKeyword', ($event.target as HTMLInputElement).value)"
                  @keyup.enter.prevent="emit('searchPlayers')"
                />
                <button type="button" class="btn btn-sm h-10" :disabled="searching" @click="emit('searchPlayers')">
                  {{ searching ? '搜索中' : '搜索' }}
                </button>
              </div>
              <div v-if="searchResults.length" class="mt-3 grid gap-2">
                <button
                  v-for="player in searchResults"
                  :key="player.id"
                  type="button"
                  class="flex items-center gap-2 rounded-xl border border-base-300 bg-base-100 p-2 text-left"
                  @click="emit('addCustomPlayer', player)"
                >
                  <img v-if="player.avatar_url" :src="player.avatar_url" class="h-8 w-8 rounded-full object-cover" />
                  <span v-else class="flex h-8 w-8 items-center justify-center rounded-full bg-base-300 text-xs font-bold">
                    {{ playerName(player).charAt(0) }}
                  </span>
                  <span class="flex-1 text-sm font-semibold">{{ playerName(player) }}</span>
                  <span class="text-xs text-primary">加入</span>
                </button>
              </div>
            </div>

            <div class="mt-4 rounded-xl bg-base-100/80 p-3">
              <div class="flex items-center justify-between">
                <p class="text-sm font-semibold">扣费明细</p>
                <p class="text-xs text-base-content/50">{{ form.charges.length }} 人</p>
              </div>
              <div v-if="form.charges.length" class="mt-3 grid gap-2">
                <div
                  v-for="charge in form.charges"
                  :key="charge.userId"
                  class="grid grid-cols-[1fr,8rem,auto] items-center gap-2"
                >
                  <span class="truncate text-sm font-medium">
                    {{ playerName(playerById[charge.userId]) }}
                  </span>
                  <input
                    v-model="charge.amount"
                    type="number"
                    min="0"
                    step="0.01"
                    class="input input-bordered input-sm"
                    placeholder="金额"
                    :disabled="form.mode === 'aa' || submitting"
                  />
                  <button
                    v-if="form.participantScope === 'custom_users'"
                    type="button"
                    class="btn btn-ghost btn-xs text-error"
                    @click="emit('removeCustomPlayer', charge.userId)"
                  >
                    移除
                  </button>
                </div>
              </div>
              <p v-else class="mt-3 text-sm text-base-content/50">
                {{ form.participantScope === 'custom_users' ? '请先选择扣费人员。' : '当前没有参加人员。' }}
              </p>
              <p v-if="summary?.settled" class="mt-3 text-xs text-warning">
                再次提交会先冲正当前有效批次，再生成新的结算批次。
              </p>
            </div>

            <div class="mt-4 flex justify-end">
              <button type="submit" class="btn btn-primary" :disabled="!activityEnded || submitting">
                <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
                {{ summary?.settled ? '重新结算' : '执行结算' }}
              </button>
            </div>
          </form>
        </div>

        <div v-if="summary?.history?.length" class="mt-4 overflow-x-auto rounded-2xl border border-base-300">
          <table class="table table-sm min-w-[860px]">
            <thead>
              <tr>
                <th>批次</th>
                <th>动作</th>
                <th>方式</th>
                <th>总金额</th>
                <th>人均</th>
                <th>人数</th>
                <th>说明</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="batch in summary.history" :key="batch.batch_no">
                <td class="font-semibold">第 {{ batch.batch_no }} 批</td>
                <td>{{ batch.operation_type === 'reverse' ? '冲正' : '结算' }}</td>
                <td>{{ settlementModeLabel(batch.mode) }} · {{ settlementScopeLabel(batch.participant_scope) }}</td>
                <td class="font-mono">{{ formatSettlementCurrency(batch.total_amount) }}</td>
                <td class="font-mono">{{ formatSettlementCurrency(batch.aa_fee) }}</td>
                <td>{{ batch.user_count }}</td>
                <td class="max-w-[20rem] whitespace-normal text-sm">{{ batch.description }}</td>
                <td class="text-xs text-base-content/60">{{ new Date(batch.created_at).toLocaleString('zh-CN') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>
