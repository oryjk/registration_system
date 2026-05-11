import { describe, expect, it } from 'vitest'
import {
  createDefaultMapSettingsForm,
  normalizeMapSettingsForSubmit,
} from '@/views/system/map-settings.model'

describe('map settings model', () => {
  it('uses tencent as the default provider', () => {
    const form = createDefaultMapSettingsForm()

    expect(form.selected_provider).toBe('tencent')
    expect(form.tencent.web_service_base_url).toBe('https://apis.map.qq.com')
    expect(form.amap.web_service_base_url).toBe('https://restapi.amap.com')
  })

  it('trims credentials and fills blank base urls with defaults', () => {
    const normalized = normalizeMapSettingsForSubmit({
      selected_provider: 'amap',
      tencent: {
        key: '  tencent-key  ',
        secret: '  tencent-secret  ',
        web_service_base_url: '   ',
      },
      amap: {
        key: '  amap-key ',
        secret: '  amap-secret ',
        web_service_base_url: ' https://restapi.amap.com/ ',
      },
    })

    expect(normalized).toEqual({
      selected_provider: 'amap',
      tencent: {
        key: 'tencent-key',
        secret: 'tencent-secret',
        web_service_base_url: 'https://apis.map.qq.com',
      },
      amap: {
        key: 'amap-key',
        secret: 'amap-secret',
        web_service_base_url: 'https://restapi.amap.com',
      },
    })
  })
})
