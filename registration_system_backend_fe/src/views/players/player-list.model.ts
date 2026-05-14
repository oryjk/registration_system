export const PLAYER_PAGE_SIZE = 20

export interface PlayerFilters {
  keyword: string
  status: number | undefined
  has_team: boolean | undefined
}

export const createPlayerFilters = (): PlayerFilters => ({
  keyword: '',
  status: undefined,
  has_team: undefined,
})

export const buildPageNumbers = (currentPage: number, totalPages: number) => {
  const pages: number[] = []
  const start = Math.max(1, currentPage - 2)
  const end = Math.min(totalPages, currentPage + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
}

export const formatPlayerDate = (date: string) => {
  if (!date) return '-'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export const roleLabel = (role: string) => {
  const map: Record<string, string> = {
    captain: '队长',
    leader: '领队',
    vice_captain: '二场队长',
    member: '队员',
  }
  return map[role] ?? role
}
