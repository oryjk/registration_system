import { adminListTeams } from '@/services/team'
import { listActivities } from '@/services/activity'
import { listPlayers } from '@/services/player'
import { listActivityFeeSnapshots } from '@/services/billing'

export interface DashboardStats {
  teamCount: number
  monthlyActivityCount: number
  playerCount: number
  feeSnapshotCount: number
}

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const [teams, activities, players, orders] = await Promise.all([
    adminListTeams().catch(() => []),
    listActivities({ page: 1, page_size: 1, status: -1 }).catch(() => ({
      counts: { total: 0 },
    })),
    listPlayers({ page: 1, page_size: 1 }).catch(() => ({ total: 0 })),
    listActivityFeeSnapshots().catch(() => []),
  ])

  return {
    teamCount: teams.length,
    monthlyActivityCount: activities.counts.total,
    playerCount: (players as { total: number }).total,
    feeSnapshotCount: orders.length,
  }
}
