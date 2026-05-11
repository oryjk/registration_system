import { http } from '@/utils/request'

export interface Team {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  captain_id: number | null
  status: number
  credit_score: number
  vip_until: string | null
  trust_label: string
  is_vip: boolean
}

export interface TeamSummary extends Team {
  member_count: number
}

export interface TeamMemberWithInfo {
  user_id: number
  role: string
  role_label: string
  jersey_number: string | null
  joined_at: string
  nickname: string
  real_name: string
  avatar_url: string
  phone_number: string
}

export interface TeamAdminInfo {
  admin_id: number
  username: string
  nickname: string
}

export interface TeamDetailForAdmin {
  team: Team
  members: TeamMemberWithInfo[]
  member_count: number
  assigned_admins: TeamAdminInfo[]
}

export interface TeamCreditTransaction {
  id: number
  team_id: string
  activity_id: string | null
  transaction_type: string
  delta: number
  score_before: number
  score_after: number
  rating: number | null
  amount: string | null
  membership_months: number | null
  note: string | null
  reviewer_team_id: string | null
  created_by_user_id: number | null
  created_by_admin_id: number | null
  created_at: string
}

export interface TeamCreditOverview {
  team: Team
  trust_label: string
  is_vip: boolean
}

export interface CreateTeamPayload {
  name: string
  description?: string
  logo_url?: string
  join_password?: string
  captain_id?: number
}

export interface UpdateTeamPayload {
  name?: string
  description?: string | null
  logo_url?: string | null
  captain_id?: number | null
  status?: number
  join_password?: string | null
}

export interface AddMemberPayload {
  user_id: number
  role?: string
  jersey_number?: string
}

export interface UpdateMemberPayload {
  role?: string
  jersey_number?: string | null
}

export const listTeams = (activeOnly = false) =>
  http.get<TeamSummary[]>('/teams', { params: activeOnly ? { status: 'active' } : {} })

/** 管理后台专用列表（有权限过滤：超级管理员看全部，普通管理员只看被分配的球队） */
export const adminListTeams = (activeOnly = false) =>
  http.get<TeamSummary[]>('/teams/admin-list', { params: activeOnly ? { status: 'active' } : {} })

export const assignAdmin = (teamId: string, adminId: number) =>
  http.post<void>(`/teams/${teamId}/admin-managers`, { admin_id: adminId })

export const unassignAdmin = (teamId: string, adminId: number) =>
  http.delete<void>(`/teams/${teamId}/admin-managers/${adminId}`)

export const listTeamAdmins = (teamId: string) =>
  http.get<TeamAdminInfo[]>(`/teams/${teamId}/admin-managers`)

export const getTeamAdminDetail = (teamId: string) =>
  http.get<TeamDetailForAdmin>(`/teams/${teamId}/admin-detail`)

export const getTeamCreditTransactions = (teamId: string, limit = 20) =>
  http.get<TeamCreditTransaction[]>(`/teams/${teamId}/credit/transactions`, {
    params: { limit },
  })

export const createTeam = (data: CreateTeamPayload) => http.post<Team>('/teams/admin', data)

export const updateTeam = (teamId: string, data: UpdateTeamPayload) =>
  http.patch<void>(`/teams/${teamId}`, data)

export const deleteTeam = (teamId: string) => http.delete<void>(`/teams/${teamId}`)

export const addMember = (teamId: string, data: AddMemberPayload) =>
  http.post<void>(`/teams/${teamId}/members`, data)

export const updateMember = (teamId: string, userId: number, data: UpdateMemberPayload) =>
  http.patch<void>(`/teams/${teamId}/members/${userId}`, data)

export const removeMember = (teamId: string, userId: number) =>
  http.delete<void>(`/teams/${teamId}/members/${userId}`)

export const batchRemoveMembers = (teamId: string, userIds: number[]) =>
  http.delete<number>(`/teams/${teamId}/members/batch`, { data: { user_ids: userIds } })

export const batchUpdateMemberStatus = (teamId: string, userIds: number[], status: number) =>
  http.patch<number>(`/teams/${teamId}/members/batch`, { user_ids: userIds, status })

export const applyTeamCreditPenalty = (teamId: string, points: number, reason: string) =>
  http.post<TeamCreditOverview>(`/teams/${teamId}/credit/penalties`, { points, reason })
