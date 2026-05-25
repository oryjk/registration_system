import { describe, expect, it } from 'vitest'
import {
  cloneHeroBannersForForm,
  createDefaultHeroBanner,
  normalizeHeroBannersForSubmit,
} from '@/views/system/mini-app-decoration.model'

describe('mini app decoration model', () => {
  it('creates the default home hero banner', () => {
    const banner = createDefaultHeroBanner()

    expect(banner.title).toBe('约球开踢')
    expect(banner.subtitle).toBe('组队 · 报名 · 上场')
    expect(banner.button_text).toBe('去看看')
    expect(banner.enabled).toBe(true)
  })

  it('trims, sorts and drops empty banners before submit', () => {
    const banners = normalizeHeroBannersForSubmit([
      {
        title: '   ',
        subtitle: 'ignore',
        button_text: '查看',
        image_url: 'https://example.com/ignore.png',
        enabled: true,
        sort_order: 2,
      },
      {
        title: '  球队约战  ',
        subtitle: '  找对手  ',
        button_text: '  ',
        image_url: ' https://example.com/team.png ',
        enabled: true,
        sort_order: 9,
      },
      {
        title: '散人开局',
        subtitle: '缺人就来',
        button_text: '报名',
        image_url: '',
        enabled: false,
        sort_order: 1,
      },
    ])

    expect(banners).toEqual([
      {
        title: '散人开局',
        subtitle: '缺人就来',
        button_text: '报名',
        image_url: '',
        enabled: false,
        sort_order: 1,
      },
      {
        title: '球队约战',
        subtitle: '找对手',
        button_text: '去看看',
        image_url: 'https://example.com/team.png',
        enabled: true,
        sort_order: 9,
      },
    ])
  })

  it('falls back to default banner when backend has no banners', () => {
    const banners = cloneHeroBannersForForm([])

    expect(banners).toHaveLength(1)
    expect(banners[0]?.title).toBe('约球开踢')
  })
})
