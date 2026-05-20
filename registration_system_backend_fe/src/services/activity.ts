import { http } from '@/utils/request'

export interface Activity {
  id: string
  name: string
  location: string
  location_latitude: number | null
  location_longitude: number | null
  status: number
  holding_date: string
  start_time: string
  end_time: string
  opposing: string | null
  cover: string | null
  description: string | null
  home_team_id: number | null
  away_team_id: number | null
  color: string | null
  opposing_color: string | null
  players_per_team: number | null
  match_kind: 'external' | 'internal' | null
  source_activity_id: string | null
  team_registration_count: number | null
  team_checkin_configs: ActivityTeamCheckinConfig[]
}

export interface ActivityTeamCheckinConfig {
  team_id: number
  enabled: boolean
  radius_meters: number
  open_minutes_before: number
  close_minutes_after: number
  checkin_open_at: string
  checkin_close_at: string
  updated_by_user_id: number | null
  updated_at: string
}

export interface RegistrationWithInfo {
  user_id: number
  stand: number
  stand_label: string
  registration_count: number
  paid: number
  operation_time: string
  checked_in_at: string | null
  checkin_distance_meters: number | null
  nickname: string
  real_name: string
  avatar_url: string
  phone_number: string
}

/** 各状态人数（全活动，不受当前筛选分页影响） */
export interface RegistrationStandCounts {
  total: number
  unknown: number
  attending: number
  leave: number
  absent: number
}

export interface RegistrationListPage {
  items: RegistrationWithInfo[]
  total: number
  page: number
  page_size: number
  counts: RegistrationStandCounts
}

/** 活动列表各状态数量（全库） */
export interface ActivityStatusCounts {
  total: number
  registering: number
  ongoing: number
  ended: number
  cancelled: number
}

export interface ActivityListPage {
  items: Activity[]
  total: number
  page: number
  page_size: number
  counts: ActivityStatusCounts
}

export interface CreateActivityPayload {
  name: string
  location: string
  location_latitude?: number
  location_longitude?: number
  holding_date: string
  start_time: string
  end_time: string
  opposing?: string
  cover?: string
  description?: string
  home_team_id?: number
  away_team_id?: number
  color?: string
  opposing_color?: string
  players_per_team?: number
}

export interface UpdateActivityPayload {
  name?: string
  location?: string
  location_latitude?: number | null
  location_longitude?: number | null
  holding_date?: string
  start_time?: string
  end_time?: string
  opposing?: string | null
  cover?: string | null
  description?: string | null
  home_team_id?: number | null
  away_team_id?: number | null
  color?: string | null
  opposing_color?: string | null
  players_per_team?: number | null
}

export interface UpdateActivityCheckinConfigPayload {
  team_id: number
  enabled: boolean
  radius_meters: number
  open_minutes_before: number
  close_minutes_after: number
}

export interface LocationSearchResult {
  provider_place_id: string
  title: string
  address: string
  display_name: string
  latitude: string
  longitude: string
}

export const STAND_LABELS: Record<number, string> = {
  0: '未表态',
  1: '参加',
  2: '请假',
  3: '迟到',
}

export const STAND_BADGE: Record<number, string> = {
  0: 'badge-ghost',
  1: 'badge-success',
  2: 'badge-warning',
  3: 'badge-error',
}

export const STATUS_LABEL: Record<number, string> = {
  0: '报名中',
  1: '进行中',
  2: '已结束',
  3: '已取消',
}

export const STATUS_BADGE: Record<number, string> = {
  0: 'badge-info',
  1: 'badge-success',
  2: 'badge-ghost',
  3: 'badge-error',
}

export interface ListActivitiesParams {
  page?: number
  page_size?: number
  /** -1 全部；0–3 按活动状态 */
  status?: number
  /** team = 有球队参与、可做球队内部报名的活动；direct = 无球队归属的直接活动 */
  registration_scope?: 'team' | 'direct'
}

export const listActivities = async (params?: ListActivitiesParams): Promise<ActivityListPage> => {
  return http.get<ActivityListPage>('/activities', { params })
}

export const searchActivityLocations = async (
  keyword: string,
  limit = 8,
): Promise<LocationSearchResult[]> => {
  return http.get<LocationSearchResult[]>('/activities/location-search', {
    params: { keyword, limit },
  })
}

export const resolveActivityLocation = async (
  latitude: number,
  longitude: number,
): Promise<LocationSearchResult> => {
  return http.get<LocationSearchResult>('/activities/location-resolve', {
    params: { latitude, longitude },
  })
}

export const getActivity = (id: string) => http.get<Activity>(`/activities/${id}`)

export const createActivity = (data: CreateActivityPayload) =>
  http.post<Activity>('/activities', data)

export const updateActivity = (id: string, data: UpdateActivityPayload) =>
  http.patch<void>(`/activities/${id}`, data)

export const updateActivityCheckinConfig = (id: string, data: UpdateActivityCheckinConfigPayload) =>
  http.patch<Activity>(`/activities/${id}/check-in-config`, data)

export const updateActivityStatus = (id: string, status: number) =>
  http.patch<void>(`/activities/${id}/status`, { status })

export const deleteActivities = (ids: string[]) =>
  http.delete<void>('/activities/batch', { data: { ids } })

export interface ListRegistrationsParams {
  page?: number
  page_size?: number
  /** -1 全部；0–3 按状态 */
  stand?: number
}

export const listRegistrations = async (
  activityId: string,
  params?: ListRegistrationsParams,
): Promise<RegistrationListPage> => {
  return http.get<RegistrationListPage>(`/activities/${activityId}/registrations`, { params })
}

export const adminRegister = (activityId: string, userId: number, stand: number) =>
  http.post<void>(`/activities/${activityId}/registrations`, {
    user_id: userId,
    stand,
    registration_count: stand === 1 ? 1 : 0,
  })

export const batchUpdateStand = (
  activityId: string,
  userIds: number[],
  stand: number,
  registrationCount?: number,
) =>
  http.patch<number>(`/activities/${activityId}/registrations/batch`, {
    user_ids: userIds,
    stand,
    registration_count: registrationCount ?? (stand === 1 ? 1 : 0),
  })

export const cancelRegistration = (activityId: string, userId: number) =>
  http.delete<void>(`/activities/${activityId}/user/${userId}/registration`)
