import type { RegistrationStandCounts } from '@/services/activity'

export const MATCH_FORMAT_OPTIONS = [5, 6, 7, 8, 11] as const
export type MatchFormatOption = (typeof MATCH_FORMAT_OPTIONS)[number]
export type ActivityColorField = 'color' | 'opposing_color'

export const COMMON_JERSEY_COLORS = [
  '#FFFFFF',
  '#F5F5F5',
  '#D1D5DB',
  '#9CA3AF',
  '#4B5563',
  '#111827',
  '#000000',
  '#7C3AED',
  '#EC4899',
  '#F43F5E',
  '#DC2626',
  '#EA580C',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#84CC16',
  '#22C55E',
  '#16A34A',
  '#10B981',
  '#14B8A6',
  '#06B6D4',
  '#0EA5E9',
  '#3B82F6',
  '#2563EB',
  '#1D4ED8',
  '#4338CA',
  '#6366F1',
  '#8B5CF6',
  '#A855F7',
  '#C026D3',
  '#BE123C',
  '#7F1D1D',
]

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i

export const normalizeHexColor = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return ''
  return HEX_COLOR_RE.test(trimmed) ? trimmed.toUpperCase() : ''
}

export const formatDateTime = (date: string) =>
  new Date(date).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export const formatTime = (date: string) =>
  new Date(date).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export const toLocalDateTimeInput = (iso: string) => (iso ? iso.slice(0, 16) : '')

export const DEFAULT_TEAM_CAPACITY_MULTIPLIER = 2

export const defaultTeamCapacityLimit = (playersPerTeam: number | null | undefined) =>
  playersPerTeam == null ? null : playersPerTeam * DEFAULT_TEAM_CAPACITY_MULTIPLIER

export const shouldRefreshDefaultTeamCapacityLimit = (
  currentLimit: unknown,
  currentPlayersPerTeam: number | null | undefined,
) => {
  if (currentLimit == null || currentLimit === '') return true
  return currentLimit === defaultTeamCapacityLimit(currentPlayersPerTeam)
}

export const normalizeTeamCapacityLimit = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

export const inferMatchFormat = (
  playersPerTeam: number | null | undefined,
): '' | `${MatchFormatOption}` => {
  if (playersPerTeam == null) return ''
  return MATCH_FORMAT_OPTIONS.includes(playersPerTeam as MatchFormatOption)
    ? (String(playersPerTeam) as `${MatchFormatOption}`)
    : ''
}

export const buildRegistrationProgress = (
  playersPerTeam: number | null | undefined,
  teamCapacityLimit: number | null | undefined,
  counts: RegistrationStandCounts,
) => {
  if (!playersPerTeam || playersPerTeam < 1) return null
  const upperLimit = teamCapacityLimit ?? defaultTeamCapacityLimit(playersPerTeam)
  if (!upperLimit || upperLimit < 1) return null

  const requiredCount = playersPerTeam
  const attendingCount = counts.attending
  const extraCapacity = Math.max(upperLimit - requiredCount, 0)
  const reachedRequirement = attendingCount >= requiredCount
  const displayPercent = reachedRequirement
    ? extraCapacity === 0
      ? 100
      : Math.round(100 + (Math.max(attendingCount - requiredCount, 0) / extraCapacity) * 100)
    : Math.round((attendingCount / requiredCount) * 100)

  return {
    matchFormat: playersPerTeam,
    upperLimit,
    requiredCount,
    reachedRequirement,
    displayPercent: Math.max(0, displayPercent),
    fillWidth: Math.min((attendingCount / upperLimit) * 100, 100),
    requiredMarker: Number(((requiredCount / upperLimit) * 100).toFixed(2)),
  }
}
