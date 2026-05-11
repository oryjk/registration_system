export type MapProvider = 'tencent' | 'amap'

export interface MapProviderConfig {
  key: string
  secret: string
  web_service_base_url: string
}

export interface MapSettingsForm {
  selected_provider: MapProvider
  tencent: MapProviderConfig
  amap: MapProviderConfig
}

const DEFAULT_TENCENT_BASE_URL = 'https://apis.map.qq.com'
const DEFAULT_AMAP_BASE_URL = 'https://restapi.amap.com'

const normalizeProviderConfig = (
  config: MapProviderConfig,
  defaultBaseUrl: string,
): MapProviderConfig => ({
  key: config.key.trim(),
  secret: config.secret.trim(),
  web_service_base_url: config.web_service_base_url.trim().replace(/\/+$/, '') || defaultBaseUrl,
})

export const createDefaultMapSettingsForm = (): MapSettingsForm => ({
  selected_provider: 'tencent',
  tencent: {
    key: '',
    secret: '',
    web_service_base_url: DEFAULT_TENCENT_BASE_URL,
  },
  amap: {
    key: '',
    secret: '',
    web_service_base_url: DEFAULT_AMAP_BASE_URL,
  },
})

export const normalizeMapSettingsForSubmit = (form: MapSettingsForm): MapSettingsForm => ({
  selected_provider: form.selected_provider,
  tencent: normalizeProviderConfig(form.tencent, DEFAULT_TENCENT_BASE_URL),
  amap: normalizeProviderConfig(form.amap, DEFAULT_AMAP_BASE_URL),
})
