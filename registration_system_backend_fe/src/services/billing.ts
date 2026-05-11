import { http } from '@/utils/request'

export interface ActivitySettlementSummary {
  activity_id: string
  description: string | null
  total_amount: string | null
  aa_fee: string | null
  attending_user_count: number
  settled_user_count: number
  settled: boolean
  settled_at: string | null
  current_batch_no: number | null
  history: ActivitySettlementBatch[]
}

export interface ActivitySettlementBatch {
  batch_no: number
  operation_type: 'settle' | 'reverse' | string
  reversal_of_batch_no: number | null
  description: string
  total_amount: string
  aa_fee: string
  user_count: number
  created_by_admin_id: number | null
  created_at: string
}

export interface SettleActivityExpensePayload {
  total_amount: number
  description?: string
}

export const getActivitySettlement = (activityId: string) =>
  http.get<ActivitySettlementSummary>(`/orders/activities/${activityId}/settlement`)

export const settleActivityExpense = (
  activityId: string,
  data: SettleActivityExpensePayload,
) => http.post<ActivitySettlementSummary>(`/orders/activities/${activityId}/settlement`, data)

export interface ActivityOrder {
  id: number
  activity_id: string
  description: string
  fee: string
  total: number
}

export interface ActivityBillingSummary {
  month_key: string
  activity_id: string
  activity_name: string
  holding_date: string
  location: string
  total: number | null
  fee: string | null
  user_id: number | null
  stand: number | null
  registration_count: number | null
}

export interface UserAccountSummary {
  user_id: number
  balance: string
  total_recharge: string
  total_expense: string
  total_penalty: string
}

export const listOrders = () => http.get<ActivityOrder[]>('/orders')

export const getActivitiesBilling = () =>
  http.get<ActivityBillingSummary[]>('/orders/activities/billing')

export const getUsersBilling = () => http.get<UserAccountSummary[]>('/orders/users/billing')
