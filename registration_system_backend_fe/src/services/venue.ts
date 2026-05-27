import { http } from '@/utils/request'
import type { Player, PlayerListResult } from './player'

export interface Venue extends Player {}

export interface VenueListQuery {
  keyword?: string
  status?: number
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: string
}

export interface CreateVenueAccountPayload {
  username: string
  password: string
  real_name: string
  nickname?: string
  phone_number?: string
}

export interface BindVenueUserOption {
  id: number
  nickname: string
  real_name: string
  avatar_url: string
  phone_number: string
  is_venue: boolean
}

export interface ChangeVenuePasswordPayload {
  password: string
}

export interface FreezeVenuePayload {
  freeze_start_time: string
  freeze_end_time?: string
}

export const listVenues = (params: VenueListQuery) =>
  http.get<PlayerListResult>('/users/players', {
    params: {
      ...params,
      role: 'venue',
    },
  })

export const createVenueAccount = (data: CreateVenueAccountPayload) =>
  http.post('/users/players/role-users', {
    role: 'venue',
    ...data,
  })

export const searchMiniUsers = (keyword: string, limit = 20) =>
  http.get<BindVenueUserOption[]>('/users/search', {
    params: { keyword, limit },
  })

export const bindUserAsVenue = (userId: number) =>
  http.patch(`/users/players/${userId}`, {
    is_venue: true,
  })

export const updateVenue = (id: number, data: { real_name?: string; nickname?: string; phone_number?: string }) =>
  http.patch(`/users/players/${id}`, data)

export const changeVenuePassword = (id: number, data: ChangeVenuePasswordPayload) =>
  http.patch(`/users/players/${id}/password`, data)

export const freezeVenue = (id: number, data: FreezeVenuePayload) =>
  http.post(`/users/players/${id}/freeze`, data)

export const unfreezeVenue = (id: number) => http.post(`/users/players/${id}/unfreeze`, {})

export const removeVenue = (id: number) => http.delete(`/users/venues/${id}`)
