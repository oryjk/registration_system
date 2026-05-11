import { http } from '@/utils/request'

export interface PlayerTeam {
  team_id: string
  team_name: string
  role: string
  jersey_number: string | null
}

export interface Player {
  id: number
  nickname: string
  real_name: string
  avatar_url: string
  phone_number: string
  status: number
  status_label: string
  create_time: string
  latest_login_date: string
  freeze_start_time: string | null
  freeze_end_time: string | null
  teams: PlayerTeam[]
  team_count: number
}

export interface PlayerListResult {
  items: Player[]
  total: number
  page: number
  page_size: number
}

export interface PlayerListQuery {
  keyword?: string
  status?: number
  has_team?: boolean
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}

export interface CreatePlayerPayload {
  real_name: string
  nickname?: string
  phone_number?: string
}

export interface UpdatePlayerPayload {
  real_name?: string
  nickname?: string
  phone_number?: string
}

export interface FreezePlayerPayload {
  freeze_start_time: string // YYYY-MM-DDTHH:MM:SS
  freeze_end_time?: string // 可选
}

export const listPlayers = (params: PlayerListQuery) =>
  http.get<PlayerListResult>('/users/players', { params })

export const getPlayerDetail = (id: number) => http.get<Player>(`/users/players/${id}`)

export const createPlayer = (data: CreatePlayerPayload) =>
  http.post<{ id: number }>('/users/players', data)

export const updatePlayer = (id: number, data: UpdatePlayerPayload) =>
  http.patch<void>(`/users/players/${id}`, data)

export const freezePlayer = (id: number, data: FreezePlayerPayload) =>
  http.post<void>(`/users/players/${id}/freeze`, data)

export const unfreezePlayer = (id: number) => http.post<void>(`/users/players/${id}/unfreeze`, {})

export const deletePlayer = (id: number) => http.delete<void>(`/users/${id}`)
