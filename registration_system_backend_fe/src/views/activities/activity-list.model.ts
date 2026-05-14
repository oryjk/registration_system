import type { ActivityStatusCounts } from '@/services/activity'

export const ACTIVITY_STATUS_FILTERS = [
  { value: -1, label: '全部' },
  { value: 0, label: '报名中' },
  { value: 1, label: '进行中' },
  { value: 2, label: '已结束' },
  { value: 3, label: '已取消' },
]

export const activityFilterTabCount = (counts: ActivityStatusCounts, status: number) => {
  if (status === -1) return counts.total
  if (status === 0) return counts.registering
  if (status === 1) return counts.ongoing
  if (status === 2) return counts.ended
  if (status === 3) return counts.cancelled
  return 0
}

export const formatActivityMonth = (date: string) =>
  new Date(date).toLocaleDateString('zh-CN', { month: 'short' })

export const formatActivityDay = (date: string) =>
  new Date(date).getDate().toString().padStart(2, '0')

export const formatActivityTime = (date: string) =>
  new Date(date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

export const statusActions = (status: number): Record<number, string> => {
  const all: Record<number, string> = {
    0: '设为报名中',
    1: '设为进行中',
    2: '设为已结束',
    3: '取消活动',
  }
  const result: Record<number, string> = {}
  for (const [key, label] of Object.entries(all)) {
    if (Number(key) !== status) result[Number(key)] = label
  }
  return result
}
