import { describe, expect, it } from 'vitest'

import {
  createPickedLocation,
  movePickedLocation,
  normalizeLocationSearchResults,
  renamePickedLocation,
} from '@/views/activities/location-picker.model'

describe('location picker model', () => {
  it('falls back to the first display-name segment when title is blank', () => {
    const results = normalizeLocationSearchResults([
      {
        provider_place_id: 'poi-1',
        title: '   ',
        address: '四川省成都市龙泉驿区桃都大道东段',
        display_name: '驿马河公园二期, 四川省成都市龙泉驿区桃都大道东段',
        latitude: '30.5635',
        longitude: '104.2728',
      },
    ])

    expect(results).toHaveLength(1)
    expect(results[0]!.title).toBe('驿马河公园二期')
  })

  it('marks a picked location as adjusted and updates its coordinates when dragged', () => {
    const picked = createPickedLocation({
      provider_place_id: 'poi-2',
      title: '深圳湾体育中心',
      address: '深圳市南山区滨海大道',
      display_name: '深圳湾体育中心, 深圳市南山区滨海大道',
      latitude: '22.518014',
      longitude: '113.947308',
    })

    const moved = movePickedLocation(picked, {
      latitude: 22.5195,
      longitude: 113.9488,
    })

    expect(moved.isAdjusted).toBe(true)
    expect(moved.latitude).toBe('22.519500')
    expect(moved.longitude).toBe('113.948800')
  })

  it('replaces the picked location name with the resolved location result', () => {
    const renamed = renamePickedLocation(
      createPickedLocation({
        provider_place_id: 'poi-2',
        title: '深圳湾体育中心',
        address: '深圳市南山区滨海大道',
        display_name: '深圳湾体育中心, 深圳市南山区滨海大道',
        latitude: '22.518014',
        longitude: '113.947308',
      }),
      {
        provider_place_id: 'poi-3',
        title: '腾讯滨海大厦',
        address: '深圳市南山区科技南一路',
        display_name: '腾讯滨海大厦 · 深圳市南山区科技南一路',
        latitude: '22.520263',
        longitude: '113.953130',
      },
    )

    expect(renamed.provider_place_id).toBe('poi-3')
    expect(renamed.title).toBe('腾讯滨海大厦')
    expect(renamed.display_name).toContain('科技南一路')
  })
})
