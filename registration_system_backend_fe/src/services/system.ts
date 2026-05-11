import { http } from '@/utils/request'
import type { MapSettingsForm } from '@/views/system/map-settings.model'

export type MapSettings = MapSettingsForm
export interface MapPreviewSettings {
  selected_provider: 'tencent' | 'amap'
  tencent_map_key: string
}

export const getMapSettings = () => http.get<MapSettings>('/system/map-settings')

export const updateMapSettings = (payload: MapSettings) =>
  http.patch<MapSettings>('/system/map-settings', payload)

export const getMapPreviewSettings = () =>
  http.get<MapPreviewSettings>('/system/map-preview-settings')
