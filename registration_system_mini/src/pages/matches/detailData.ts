import { getActivity, getActivityUsers, listActivities } from "@/api/activity";
import { getTeamDetail } from "@/api/team";
import { listUsers } from "@/api/user";
import type { BackendActivity, BackendRegistration, BackendTeam, BackendTeamMember, BackendUser } from "@/types/backend";
import { isActiveTeamRegistrationActivity } from "./detailState";

export interface PublicMatchDetailData {
  activity: BackendActivity;
  activityUsers: BackendRegistration[];
  usersById: Record<number, BackendUser>;
  activityPageItems: BackendActivity[];
  sourceTeamRegistrationCount: number;
}

export interface AuthenticatedMatchDetailContext {
  teamsById: Record<number, BackendTeam>;
  derivedActivity: BackendActivity | null;
  initialRegistrationCount: number;
  currentUserStand: number;
  currentTeamMembers: BackendTeamMember[];
  checkInConfig: BackendActivity["team_checkin_configs"][number] | null;
}

export async function loadPublicMatchDetailData(matchId: string): Promise<PublicMatchDetailData> {
  const [activity, activityUsers, users, activityPage] = await Promise.all([
    getActivity(matchId),
    getActivityUsers(matchId),
    listUsers(),
    listActivities({ page: 1, pageSize: 100 }),
  ]);

  return {
    activity,
    activityUsers,
    usersById: Object.fromEntries(users.map((item) => [item.id, item])),
    activityPageItems: activityPage.items,
    sourceTeamRegistrationCount: activity.source_activity_id
      ? 0
      : activityPage.items
          .filter((item) => isActiveTeamRegistrationActivity(item) && item.source_activity_id === activity.id)
          .reduce((total, item) => total + Number(item.team_registration_count ?? 0), 0),
  };
}

export async function loadAuthenticatedMatchDetailContext(params: {
  activity: BackendActivity;
  activityUsers: BackendRegistration[];
  activityPageItems: BackendActivity[];
  currentTeamId?: number | null;
  currentUserId?: number;
}): Promise<AuthenticatedMatchDetailContext> {
  const { activity, activityUsers, activityPageItems, currentTeamId, currentUserId } = params;
  const teamIds = [activity.home_team_id, activity.away_team_id].filter((teamId): teamId is number => typeof teamId === "number");
  const fetchedTeamDetails = await Promise.all(teamIds.map(async (teamId) => getTeamDetail(teamId)));
  const fetchedTeams = fetchedTeamDetails.map((detail) => detail.team);
  const currentTeamMembers = fetchedTeamDetails.find((detail) => detail.team.id === currentTeamId)?.members ?? [];
  const derivedActivity = currentTeamId
    ? activityPageItems.find(
        (item) => isActiveTeamRegistrationActivity(item) && item.source_activity_id === activity.id && item.home_team_id === currentTeamId,
      ) ?? null
    : null;

  return {
    teamsById: Object.fromEntries(fetchedTeams.map((team) => [team.id, team])),
    derivedActivity,
    initialRegistrationCount: derivedActivity?.team_registration_count ?? activity.team_registration_count ?? activity.players_per_team ?? 5,
    currentUserStand: activityUsers.find((item) => item.user_id === currentUserId)?.stand ?? 0,
    currentTeamMembers,
    checkInConfig: activity.source_activity_id
      ? null
      : activity.team_checkin_configs.find((item) => item.team_id === currentTeamId) ?? null,
  };
}
