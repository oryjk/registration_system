import { http } from '@/utils/request'
import type { MapSettingsForm } from '@/views/system/map-settings.model'

export type MapSettings = MapSettingsForm
export interface MapPreviewSettings {
  selected_provider: 'tencent' | 'amap'
  tencent_map_key: string
}

export interface MiniAppHomeHeroBanner {
  title: string
  subtitle: string
  button_text: string
  image_url: string
  enabled: boolean
  sort_order: number
}

export interface MiniAppDecorationImageUploadResult {
  image_url: string
}

export interface MiniAppHomeRuntimeConfig {
  match_card_limit: number
  challenge_card_limit: number
  activity_fetch_page_size: number
  hide_matches_after_holding_time: boolean
  hero_banners: MiniAppHomeHeroBanner[]
}

export interface MiniAppRuntimeConfig {
  home: MiniAppHomeRuntimeConfig
  matches: {
    related_activity_limit: number
    participant_avatar_limit: number
    capacity_extra_slots: number
  }
  checkin: {
    default_radius_meters: number
    default_open_minutes_before: number
    default_close_minutes_after: number
  }
  billing: {
    recent_order_limit: number
  }
  notifications: {
    list_limit: number
  }
  profile: {
    require_phone_binding: boolean
  }
}

export const getMapSettings = () => http.get<MapSettings>('/system/map-settings')

export const updateMapSettings = (payload: MapSettings) =>
  http.patch<MapSettings>('/system/map-settings', payload)

export const getMapPreviewSettings = () =>
  http.get<MapPreviewSettings>('/system/map-preview-settings')

export const getMiniAppRuntimeConfig = () =>
  http.get<MiniAppRuntimeConfig>('/system/mini-app-runtime-config')

export const updateMiniAppRuntimeConfig = (payload: MiniAppRuntimeConfig) =>
  http.patch<MiniAppRuntimeConfig>('/system/mini-app-runtime-config', payload)

export const uploadMiniAppDecorationImage = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return http.post<MiniAppDecorationImageUploadResult>('/system/mini-app-decoration/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
