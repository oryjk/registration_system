import type { ActivitySettlementSummary } from '@/services/billing'
import type { RegistrationWithInfo } from '@/services/activity'
import type { Player } from '@/services/player'

export type SettlementMode = 'aa' | 'manual'
export type SettlementParticipantScope = 'registered_attendees' | 'custom_users'

export interface SettlementChargeDraft {
  userId: number
  amount: string
}

export interface SettlementFormState {
  totalAmount: string
  description: string
  mode: SettlementMode
  participantScope: SettlementParticipantScope
  charges: SettlementChargeDraft[]
}

export const createSettlementForm = (): SettlementFormState => ({
  totalAmount: '',
  description: '赛后 AA 扣费',
  mode: 'aa',
  participantScope: 'registered_attendees',
  charges: [],
})

export const formatSettlementCurrency = (value?: string | number | null) => {
  if (value == null || value === '') return '—'
  const amount = Number(value)
  if (Number.isNaN(amount)) return String(value)
  return `¥${amount.toFixed(2)}`
}

export const normalizeAmountText = (value?: string | number | null) => {
  if (value == null || value === '') return ''
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ''
  return amount.toFixed(2).replace(/\.00$/, '')
}

export const settlementModeLabel = (mode?: string | null) =>
  mode === 'manual' ? '手动金额' : 'AA 平摊'

export const settlementScopeLabel = (scope?: string | null) =>
  scope === 'custom_users' ? '自定义人员' : '参加名单'

export const playerName = (player?: Pick<Player, 'real_name' | 'nickname' | 'id'> | null) =>
  player?.real_name || player?.nickname || (player?.id ? `用户 ${player.id}` : '未知用户')

export const buildRegisteredSettlementCharges = (
  registrations: RegistrationWithInfo[],
  existingCharges: SettlementChargeDraft[],
): SettlementChargeDraft[] => {
  const existingAmountByUserId = new Map(existingCharges.map((item) => [item.userId, item.amount]))
  return registrations
    .filter((item) => item.stand === 1)
    .map((item) => ({
      userId: item.user_id,
      amount: existingAmountByUserId.get(item.user_id) ?? '',
    }))
}

export const patchSettlementFormFromSummary = (
  form: SettlementFormState,
  summary: ActivitySettlementSummary,
) => {
  if (!form.totalAmount && summary.total_amount) {
    form.totalAmount = normalizeAmountText(summary.total_amount)
  }
  if ((!form.description || form.description === '赛后 AA 扣费') && summary.description) {
    form.description = summary.description
  }
  if (summary.mode === 'aa' || summary.mode === 'manual') {
    form.mode = summary.mode
  }
  if (
    summary.participant_scope === 'registered_attendees' ||
    summary.participant_scope === 'custom_users'
  ) {
    form.participantScope = summary.participant_scope
  }
  if (summary.items.length > 0) {
    form.charges = summary.items.map((item) => ({
      userId: item.user_id,
      amount: normalizeAmountText(item.fee),
    }))
  }
}

export const validateSettlementForm = (
  form: SettlementFormState,
  attendingUserCount: number,
) => {
  const totalAmount = Number(form.totalAmount)
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return '请输入大于 0 的结算总金额'
  }

  const participantCount =
    form.participantScope === 'registered_attendees' ? attendingUserCount : form.charges.length
  if (participantCount <= 0) {
    return form.participantScope === 'custom_users' ? '请先选择扣费人员' : '当前没有参加人员'
  }

  if (form.mode === 'manual') {
    const invalid = form.charges.some((item) => {
      const amount = Number(item.amount)
      return !Number.isFinite(amount) || amount <= 0
    })
    if (invalid) return '手动金额需要给每个人填写大于 0 的金额'

    const chargeTotal = form.charges.reduce((sum, item) => sum + Number(item.amount), 0)
    if (Math.abs(chargeTotal - totalAmount) > 0.01) {
      return '手动金额合计需要等于结算总金额'
    }
  }

  return ''
}
