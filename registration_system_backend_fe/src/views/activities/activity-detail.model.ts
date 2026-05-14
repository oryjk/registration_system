import type { RegistrationStandCounts } from '@/services/activity'

export const MATCH_FORMAT_OPTIONS = [5, 6, 7, 8, 11] as const
export type MatchFormatOption = (typeof MATCH_FORMAT_OPTIONS)[number]

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

export const playersPerTeamFromMatchFormat = (matchFormat: MatchFormatOption) =>
  matchFormat * 2 - 1

export const inferMatchFormat = (
  playersPerTeam: number | null | undefined,
): '' | `${MatchFormatOption}` => {
  if (playersPerTeam == null) return ''
  const matched = MATCH_FORMAT_OPTIONS.find(
    (option) => playersPerTeamFromMatchFormat(option) === playersPerTeam,
  )
  return matched ? (String(matched) as `${MatchFormatOption}`) : ''
}

export const buildRegistrationProgress = (
  playersPerTeam: number | null | undefined,
  counts: RegistrationStandCounts,
) => {
  const upperLimit = playersPerTeam ?? null
  if (!upperLimit || upperLimit < 1) return null

  const matchedFormat = MATCH_FORMAT_OPTIONS.find(
    (option) => playersPerTeamFromMatchFormat(option) === upperLimit,
  )
  if (!matchedFormat) return null

  const requiredCount = matchedFormat
  const attendingCount = counts.attending
  const extraCapacity = Math.max(upperLimit - requiredCount, 0)
  const reachedRequirement = attendingCount >= requiredCount
  const displayPercent = reachedRequirement
    ? extraCapacity === 0
      ? 100
      : Math.round(100 + (Math.max(attendingCount - requiredCount, 0) / extraCapacity) * 100)
    : Math.round((attendingCount / requiredCount) * 100)

  return {
    matchFormat: matchedFormat,
    upperLimit,
    requiredCount,
    reachedRequirement,
    displayPercent: Math.max(0, displayPercent),
    fillWidth: Math.min((attendingCount / upperLimit) * 100, 100),
    requiredMarker: Number(((requiredCount / upperLimit) * 100).toFixed(2)),
  }
}
