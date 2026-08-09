import { getActivity, getActivityUsers, listActivities } from "@/api/activity";
import { listMyMatches } from "@/api/match";
import { getTeamDetail } from "@/api/team";
import { listUsers } from "@/api/user";
import type { AppMatchSummary } from "@/types/match";
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

const GO_MATCH_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toLegacyActivityStatus(status: AppMatchSummary["status"]): number {
  switch (status) {
    case "ongoing":
      return 1;
    case "ended":
      return 2;
    case "cancelled":
      return 3;
    default:
      return 0;
  }
}

export function toBackendActivity(match: AppMatchSummary): BackendActivity {
  return {
    id: match.id,
    name: match.name,
    location: match.location,
    location_latitude: match.location_latitude,
    location_longitude: match.location_longitude,
    status: toLegacyActivityStatus(match.status),
    holding_date: match.start_time,
    start_time: match.start_time,
    end_time: match.end_time,
    opposing: match.opponent_name ?? match.away_team_name,
    cover: null,
    description: match.description,
    home_team_id: match.host_team_id,
    away_team_id: match.away_team_id,
    color: "#9be22b",
    opposing_color: "#0f766e",
    players_per_team: match.players_per_team,
    team_capacity_limit: match.players_per_team,
    match_kind: "external",
    source_activity_id: null,
    team_registration_count: null,
    team_checkin_configs: [],
  };
}

async function findGoMatch(matchId: string): Promise<AppMatchSummary | null> {
  const pageSize = 100;
  let page = 1;

  while (true) {
    const result = await listMyMatches({ page, pageSize });
    const match = result.items.find((item) => item.id === matchId);
    if (match) return match;
    if (!result.items.length || page * result.page_size >= result.total) return null;
    page += 1;
  }
}

async function loadActivityDetail(matchId: string): Promise<{ activity: BackendActivity; fromGo: boolean }> {
  if (!GO_MATCH_ID_PATTERN.test(matchId)) {
    return { activity: await getActivity(matchId), fromGo: false };
  }

  const goMatch = await findGoMatch(matchId);
  if (goMatch) return { activity: toBackendActivity(goMatch), fromGo: true };

  return { activity: await getActivity(matchId), fromGo: false };
}

export async function loadPublicMatchDetailData(matchId: string): Promise<PublicMatchDetailData> {
  const detail = await loadActivityDetail(matchId);
  const [activityUsers, users, activityPageItems] = await Promise.all([
    detail.fromGo ? Promise.resolve<BackendRegistration[]>([]) : getActivityUsers(matchId),
    listUsers(),
    detail.fromGo
      ? Promise.resolve<BackendActivity[]>([detail.activity])
      : listActivities({ page: 1, pageSize: 100 }).then((page) => page.items),
  ]);

  return {
    activity: detail.activity,
    activityUsers,
    usersById: Object.fromEntries(users.map((item) => [item.id, item])),
    activityPageItems,
    sourceTeamRegistrationCount: detail.activity.source_activity_id
      ? 0
      : activityPageItems
          .filter((item) => isActiveTeamRegistrationActivity(item) && item.source_activity_id === detail.activity.id)
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
