import { getActivity, getActivityUsers, listActivities } from "@/api/activity";
import { getMatchDetail } from "@/api/match";
import { getTeamDetail } from "@/api/team";
import { listUsers } from "@/api/user";
import type { AppMatchDetailResponse, AppMatchGroupDetail, AppMatchRegistration, AppMatchSummary } from "@/types/match";
import type { BackendActivity, BackendRegistration, BackendTeam, BackendTeamMember, BackendUser } from "@/types/backend";
import { isActiveTeamRegistrationActivity } from "./detailState";

export interface PublicMatchDetailData {
  activity: BackendActivity;
  activityUsers: BackendRegistration[];
  usersById: Record<number, BackendUser>;
  activityPageItems: BackendActivity[];
  sourceTeamRegistrationCount: number;
  myRegistration: AppMatchRegistration | null;
  fromGo: boolean;
  goRegistrationGroupId: string;
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

export interface MatchDetailDataLoaders {
  getActivity: typeof getActivity;
  getActivityUsers: typeof getActivityUsers;
  getMatchDetail: typeof getMatchDetail;
  listActivities: typeof listActivities;
  listUsers: typeof listUsers;
}

export interface MatchDetailGroupSelection {
  preferredGroupId?: string;
  currentTeamId?: number | null;
}

const defaultMatchDetailDataLoaders: MatchDetailDataLoaders = {
  getActivity,
  getActivityUsers,
  getMatchDetail,
  listActivities,
  listUsers,
};

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

export function buildGoPublicMatchDetailData(
  goDetail: AppMatchDetailResponse,
  currentUserId?: number,
  selection: MatchDetailGroupSelection = {},
): PublicMatchDetailData {
  const group =
    goDetail.groups.find((item) => item.my_registration) ??
    goDetail.groups.find((item) => item.id === selection.preferredGroupId) ??
    (selection.currentTeamId != null
      ? goDetail.groups.find((item) => item.team_id === selection.currentTeamId)
      : undefined) ??
    goDetail.groups.find((item) => item.kind === "individual_opponent" && item.status === "open") ??
    goDetail.groups.find((item) => item.status === "open") ??
    goDetail.groups[0];
  const activity = toBackendActivity(goDetail.match, group);
  const myRegistration = group?.my_registration ?? null;
  const activityUsers = myRegistration && currentUserId
    ? [toBackendRegistration(myRegistration, currentUserId, goDetail.match.updated_at)]
    : [];

  return {
    activity,
    activityUsers,
    usersById: {},
    activityPageItems: [activity],
    myRegistration,
    fromGo: true,
    goRegistrationGroupId: group?.id ?? "",
    sourceTeamRegistrationCount: Math.max(
      Number(activity.team_registration_count ?? 0) - activityUsers.filter((item) => item.stand === 1).length,
      0,
    ),
  };
}

export async function loadPublicMatchDetailData(
  matchId: string,
  currentUserId?: number,
  selection: MatchDetailGroupSelection = {},
  loaders: MatchDetailDataLoaders = defaultMatchDetailDataLoaders,
): Promise<PublicMatchDetailData> {
  if (GO_MATCH_ID_PATTERN.test(matchId)) {
    return buildGoPublicMatchDetailData(await loaders.getMatchDetail(matchId), currentUserId, selection);
  }

  const activity = await loaders.getActivity(matchId);
  const [activityUsers, users, activityPageItems] = await Promise.all([
    loaders.getActivityUsers(matchId),
    loaders.listUsers(),
    loaders.listActivities({ page: 1, pageSize: 100 }).then((page) => page.items),
  ]);

  return {
    activity,
    activityUsers,
    usersById: Object.fromEntries(users.map((item) => [item.id, item])),
    activityPageItems,
    myRegistration: null,
    fromGo: false,
    goRegistrationGroupId: "",
    sourceTeamRegistrationCount: activity.source_activity_id
      ? 0
      : activityPageItems
          .filter((item) => isActiveTeamRegistrationActivity(item) && item.source_activity_id === activity.id)
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
