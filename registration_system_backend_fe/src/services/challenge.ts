import { http } from '@/utils/request'

export type ChallengeStatus = 'open' | 'matched' | 'cancelled'
export type ChallengeKind = 'team' | 'individual'

export interface Challenge {
  id: string
  title: string
  kind: ChallengeKind
  host_team_id: number | null
  host_user_id: number
  guest_team_id: number | null
  accepted_by_user_id: number | null
  activity_id: string | null
  holding_date: string
  start_time: string
  end_time: string
  location: string
  location_latitude: number | null
  location_longitude: number | null
  players_per_team: number
  fee_per_person: string | null
  note: string | null
  status: ChallengeStatus
  accepted_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface ChallengeSummary {
  challenge: Challenge
  host_team_name: string
  host_team_credit_score: number
  host_team_trust_label: string
  guest_team_name: string | null
  guest_team_credit_score: number | null
  guest_team_trust_label: string | null
  current_team_relation: string | null
  can_accept: boolean
}

export interface ChallengeActivityRef {
  id: string
  name: string
  holding_date: string
  start_time: string
  end_time: string
  location: string
  home_team_id: number | null
  away_team_id: number | null
  players_per_team: number | null
}

export interface ChallengeDetail {
  summary: ChallengeSummary
  activity: ChallengeActivityRef | null
}

export const adminListChallenges = (params: {
  team_id?: number
  keyword?: string
  status?: ChallengeStatus
  include_closed?: boolean
  limit?: number
  sort?: 'holding_date_asc' | 'holding_date_desc' | 'created_at_desc' | 'credit_desc'
}) =>
  http.get<ChallengeSummary[]>('/challenges', {
    params: {
      team_id: params.team_id,
      keyword: params.keyword,
      status: params.status,
      include_closed: params.include_closed ?? false,
      limit: params.limit ?? 50,
      sort: params.sort ?? 'holding_date_asc',
    },
  })

export const getAdminChallengeDetail = (challengeId: string) =>
  http.get<ChallengeDetail>(`/challenges/${challengeId}`)
