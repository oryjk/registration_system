import type { Player } from '@/services/player'
import type { TeamMemberWithInfo } from '@/services/team'

export const memberToPlayer = (member: TeamMemberWithInfo): Player => ({
  id: member.user_id,
  nickname: member.nickname,
  real_name: member.real_name,
  avatar_url: member.avatar_url,
  phone_number: member.phone_number,
  status: 1,
  status_label: '',
  create_time: '',
  latest_login_date: '',
  freeze_start_time: null,
  freeze_end_time: null,
  teams: [],
  team_count: 0,
})

export const roleColors: Record<string, string> = {
  captain: 'bg-warning text-warning-content',
  leader: 'bg-primary text-primary-content',
  vice_captain: 'bg-secondary text-secondary-content',
}

export const roleBgClass: Record<string, string> = {
  captain: 'bg-warning text-warning-content',
  leader: 'bg-primary text-primary-content',
  vice_captain: 'bg-secondary text-secondary-content',
  member: 'bg-base-300',
}

export const roleBadgeClass: Record<string, string> = {
  captain: 'badge-warning',
  leader: 'badge-primary',
  vice_captain: 'badge-secondary',
  member: 'badge-ghost',
}

export const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

export const formatDateTime = (date: string | null) =>
  date
    ? new Date(date).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '未开通'

export const transactionTypeLabel = (type: string) => {
  switch (type) {
    case 'match_review':
      return '赛后互评'
    case 'membership_recharge':
      return '会员充值'
    case 'manual_penalty':
      return '后台罚扣'
    default:
      return '信用变动'
  }
}
