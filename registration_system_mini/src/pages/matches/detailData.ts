import { getActivity, getActivityUsers, listActivities } from "@/api/activity";
import { getMatchDetail } from "@/api/match";
import { getTeamDetail } from "@/api/team";
import { listUsers } from "@/api/user";
import type { AppMatchGroupDetail, AppMatchRegistration, AppMatchSummary } from "@/types/match";
import type { BackendActivity, BackendRegistration, BackendTeam, BackendTeamMember, BackendUser } from "@/types/backend";
import { isActiveTeamRegistrationActivity } from "./detailState";

export interface PublicMatchDetailData {
  activity: BackendActivity;
  activityUsers: BackendRegistration[];
  usersById: Record<number, BackendUser>;
  activityPageItems: BackendActivity[];
  sourceTeamRegistrationCount: number;
  myRegistration: AppMatchRegistration | null;
}

export interface AuthenticatedMatchDetailContext {
  teamsById: Record<number, BackendTeam>;
  derivedActivity: BackendActivity | null;
  initialRegistrationCount: number;
  currentUserStand: number;
  currentTeamMembers: BackendTeamMember[];
  checkInConfig: BackendActivity["team_checkin_configs"][number] | null;
}

export const GO_MATCH_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export function toBackendActivity(match: AppMatchSummary, group?: AppMatchGroupDetail): BackendActivity {
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
    team_capacity_limit: group?.max_players ?? match.players_per_team,
    match_kind: "external",
    source_activity_id: null,
    team_registration_count: group?.attending_count ?? null,
    team_checkin_configs: [],
  };
}

export function toLegacyRegistrationStand(status: AppMatchRegistration["status"] | null | undefined): number {
  switch (status) {
    case "attending":
      return 1;
    case "leave":
      return 2;
    case "absent":
      return 3;
    default:
      return 0;
  }
}

export function toBackendRegistration(
  registration: AppMatchRegistration,
  currentUserId: number,
  operationTime: string,
): BackendRegistration {
  return {
    user_id: currentUserId,
    stand: toLegacyRegistrationStand(registration.status),
    registration_count: registration.registration_count,
    paid: 0,
    operation_time: operationTime,
  };
}

async function loadActivityDetail(matchId: string): Promise<{
  activity: BackendActivity;
  fromGo: boolean;
  myRegistration: AppMatchRegistration | null;
  registrationOperationTime: string;
}> {
  if (!GO_MATCH_ID_PATTERN.test(matchId)) {
    return { activity: await getActivity(matchId), fromGo: false, myRegistration: null, registrationOperationTime: "" };
  }

  const goDetail = await getMatchDetail(matchId);
  const group = goDetail.groups.find((item) => item.my_registration) ?? goDetail.groups[0];
  return {
    activity: toBackendActivity(goDetail.match, group),
    fromGo: true,
    myRegistration: group?.my_registration ?? null,
    registrationOperationTime: goDetail.match.updated_at,
  };
}

export async function loadPublicMatchDetailData(matchId: string, currentUserId?: number): Promise<PublicMatchDetailData> {
  const detail = await loadActivityDetail(matchId);
  const goActivityUsers = detail.fromGo && detail.myRegistration && currentUserId
    ? [toBackendRegistration(detail.myRegistration, currentUserId, detail.registrationOperationTime)]
    : [];
  const [activityUsers, users, activityPageItems] = await Promise.all([
    detail.fromGo ? Promise.resolve(goActivityUsers) : getActivityUsers(matchId),
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
    myRegistration: detail.myRegistration,
    sourceTeamRegistrationCount: detail.fromGo
      ? Math.max(
          Number(detail.activity.team_registration_count ?? 0) - activityUsers.filter((item) => item.stand === 1 || item.stand === 3).length,
          0,
        )
      : detail.activity.source_activity_id
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
  myRegistration?: AppMatchRegistration | null;
  currentTeamId?: number | null;
  currentUserId?: number;
}): Promise<AuthenticatedMatchDetailContext> {
  const { activity, activityUsers, activityPageItems, myRegistration, currentTeamId, currentUserId } = params;
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
    currentUserStand: myRegistration
      ? toLegacyRegistrationStand(myRegistration.status)
      : activityUsers.find((item) => item.user_id === currentUserId)?.stand ?? 0,
    currentTeamMembers,
    checkInConfig: activity.source_activity_id
      ? null
      : activity.team_checkin_configs.find((item) => item.team_id === currentTeamId) ?? null,
  };
}
