import type { MiniAppHomeHeroBanner } from '@/services/system'

export type MiniAppHeroBannerForm = MiniAppHomeHeroBanner

export const createDefaultHeroBanner = (sortOrder = 1): MiniAppHeroBannerForm => ({
  title: '约球开踢',
  subtitle: '组队 · 报名 · 上场',
  button_text: '去看看',
  image_url: '',
  enabled: true,
  sort_order: sortOrder,
})

const truncate = (value: string, maxLength: number) =>
  Array.from(value.trim()).slice(0, maxLength).join('')

export const normalizeHeroBannersForSubmit = (
  banners: MiniAppHeroBannerForm[],
): MiniAppHeroBannerForm[] => {
  const normalized = banners
    .map((banner, index) => ({
      title: truncate(banner.title, 20),
      subtitle: truncate(banner.subtitle, 30),
      button_text: truncate(banner.button_text, 10) || '去看看',
      image_url: truncate(banner.image_url, 512),
      enabled: banner.enabled,
      sort_order: Number.isFinite(banner.sort_order) ? banner.sort_order : index + 1,
    }))
    .filter((banner) => banner.title.length > 0)
    .slice(0, 10)
    .sort((a, b) => a.sort_order - b.sort_order)

  return normalized.length > 0 ? normalized : [createDefaultHeroBanner()]
}

export const cloneHeroBannersForForm = (
  banners: MiniAppHomeHeroBanner[] | undefined,
): MiniAppHeroBannerForm[] =>
  normalizeHeroBannersForSubmit(
    banners && banners.length > 0 ? banners.map((banner) => ({ ...banner })) : [createDefaultHeroBanner()],
  )
