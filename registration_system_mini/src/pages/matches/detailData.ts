import { getActivity, getActivityUsers, listActivities } from "@/api/activity";
import { getMatchDetail } from "@/api/match";
import { getTeamDetail } from "@/api/team";
import { listUsers } from "@/api/user";
import type { AppMatchDetailResponse, AppMatchGroupDetail, AppMatchParticipant, AppMatchRegistration, AppMatchSummary } from "@/types/match";
import type { BackendActivity, BackendRegistration, BackendTeam, BackendTeamMember, BackendUser } from "@/types/backend";
import { getMatchPublicationModeLabel } from "@/utils/matchPublicationMode";
import { isActiveTeamRegistrationActivity } from "./detailState";

export interface PublicMatchDetailData {
  activity: BackendActivity;
  activityUsers: BackendRegistration[];
  usersById: Record<number, BackendUser>;
  activityPageItems: BackendActivity[];
  sourceTeamRegistrationCount: number;
  myRegistration: AppMatchRegistration | null;
  fromMatchApi: boolean;
  registrationGroupId: string;
  publicationModeLabel: string;
  /** 新比赛接口的原始比赛对象（legacy 活动为 null）；接约申请管理等需要 publication_mode / opponent_state 的功能用它判定。 */
  sourceMatch: AppMatchSummary | null;
  /** 球队约队的主/客队报名分组（各自进度），供详情页展示双方进度条；legacy 为空。 */
  teamGroups: MatchTeamGroupSummary[];
  /** 当前选中报名组的最小人数（管理端「最小人数」）；散人约球的报名进度以它为目标，legacy 为 null。 */
  selectedGroupMinPlayers: number | null;
  /** 是否存在开放中的散人报名组：没有它且用户未加入任何球队时，个人报名无路径，引导先加入球队。 */
  hasOpenIndividualGroup: boolean;
}

export interface MatchTeamGroupSummary {
  id: string;
  kind: "host_team" | "guest_team";
  teamId: number | null;
  attendingCount: number;
  minPlayers: number | null;
  maxPlayers: number | null;
}

function isTeamGroup(group: AppMatchGroupDetail): group is AppMatchGroupDetail & { kind: "host_team" | "guest_team" } {
  return group.kind === "host_team" || group.kind === "guest_team";
}

function toTeamGroupSummaries(groups: AppMatchGroupDetail[]): MatchTeamGroupSummary[] {
  return groups
    .filter(isTeamGroup)
    .map((group) => ({
      id: group.id,
      kind: group.kind,
      teamId: group.team_id ?? null,
      attendingCount: group.attending_count ?? 0,
      minPlayers: group.min_players ?? null,
      maxPlayers: group.max_players ?? null,
    }));
}

export interface AuthenticatedMatchDetailContext {
  teamsById: Record<number, BackendTeam>;
  derivedActivity: BackendActivity | null;
  initialRegistrationCount: number;
  currentUserStand: number;
  currentTeamMembers: BackendTeamMember[];
  checkInConfig: BackendActivity["team_checkin_configs"][number] | null;
}

export const MATCH_API_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface MatchDetailDataLoaders {
  getActivity: typeof getActivity;
  getActivityUsers: typeof getActivityUsers;
  getMatchDetail: typeof getMatchDetail;
  getTeamDetail: typeof getTeamDetail;
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
  getTeamDetail,
  listActivities,
  listUsers,
};

function toActivityStatusCode(status: AppMatchSummary["status"]): number {
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
    status: toActivityStatusCode(match.status),
    holding_date: match.start_time,
    start_time: match.start_time,
    end_time: match.end_time,
    registration_start_at: match.registration_start_at,
    registration_end_at: match.registration_end_at,
    opposing: match.opponent_name ?? match.away_team_name,
    cover: null,
    description: match.description,
    home_team_id: match.host_team_id,
    away_team_id: match.away_team_id,
    color: match.host_color ?? "",
    opposing_color: match.away_color ?? "",
    players_per_team: match.players_per_team,
    team_capacity_limit: group?.max_players ?? match.players_per_team,
    match_kind: "external",
    source_activity_id: null,
    team_registration_count: group?.attending_count ?? null,
    team_checkin_configs: [],
  };
}

export function toRegistrationStandCode(status: AppMatchRegistration["status"] | null | undefined): number {
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
    stand: toRegistrationStandCode(registration.status),
    registration_count: registration.registration_count,
    paid: 0,
    operation_time: operationTime,
  };
}

function toBackendParticipantUser(participant: AppMatchParticipant): BackendUser {
  return {
    id: participant.user_id,
    open_id: "",
    username: "",
    nickname: participant.nickname,
    real_name: "",
    avatar_url: participant.avatar_url ?? "",
    phone_number: "",
    is_manager: false,
    is_venue: false,
  };
}

export function buildPublicMatchApiDetailData(
  matchDetail: AppMatchDetailResponse,
  currentUserId?: number,
  selection: MatchDetailGroupSelection = {},
): PublicMatchDetailData {
  const group =
    matchDetail.groups.find((item) => item.my_registration) ??
    matchDetail.groups.find((item) => item.id === selection.preferredGroupId) ??
    (selection.currentTeamId != null
      ? matchDetail.groups.find((item) => item.team_id === selection.currentTeamId)
      : undefined) ??
    matchDetail.groups.find((item) => item.kind === "individual_opponent" && item.status === "open") ??
    matchDetail.groups.find((item) => item.status === "open") ??
    matchDetail.groups[0];
  const activity = toBackendActivity(matchDetail.match, group);
  const myRegistration = group?.my_registration ?? null;
  const participants = group?.participants ?? [];
  // 三态报名板需要全部队友的出勤状态：attending→已报名、leave→请假，其余（unknown/absent/cancelled）由页面归入未报名组。
  // operation_time 用报名落库时间，保证「已报名队员」按报名先后升序；旧数据缺失时回退比赛更新时间。
  const activityUsers = participants.map((participant) => toBackendRegistration(
    { status: participant.status, registration_count: participant.registration_count ?? 1 },
    participant.user_id,
    participant.registered_at ?? matchDetail.match.updated_at,
  ));
  if (myRegistration && currentUserId && !activityUsers.some((item) => item.user_id === currentUserId)) {
    activityUsers.push(toBackendRegistration(myRegistration, currentUserId, matchDetail.match.updated_at));
  }

  return {
    activity,
    activityUsers,
    usersById: Object.fromEntries(participants.map((participant) => [
      participant.user_id,
      toBackendParticipantUser(participant),
    ])),
    activityPageItems: [activity],
    myRegistration,
    fromMatchApi: true,
    registrationGroupId: group?.id ?? "",
    publicationModeLabel: getMatchPublicationModeLabel(matchDetail.match.publication_mode),
    sourceMatch: matchDetail.match,
    teamGroups: toTeamGroupSummaries(matchDetail.groups),
    hasOpenIndividualGroup: matchDetail.groups.some((item) => item.kind === "individual_opponent" && item.status === "open"),
    selectedGroupMinPlayers: group?.min_players ?? null,
    sourceTeamRegistrationCount: Math.max(
      Number(activity.team_registration_count ?? 0)
        - activityUsers.filter((item) => item.stand === 1).reduce((total, item) => total + item.registration_count, 0),
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
  if (MATCH_API_ID_PATTERN.test(matchId)) {
    return buildPublicMatchApiDetailData(await loaders.getMatchDetail(matchId), currentUserId, selection);
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
    fromMatchApi: false,
    registrationGroupId: "",
    publicationModeLabel: activity.match_kind === "internal" ? "队内内战" : "线下已约",
    sourceMatch: null,
    teamGroups: [],
    selectedGroupMinPlayers: null,
    hasOpenIndividualGroup: false,
    sourceTeamRegistrationCount: activity.source_activity_id
      ? 0
      : activityPageItems
          .filter((item) => isActiveTeamRegistrationActivity(item) && item.source_activity_id === activity.id)
          .reduce((total, item) => total + Number(item.team_registration_count ?? 0), 0),
  };
}

export async function loadAuthenticatedMatchDetailContext(
  params: {
    activity: BackendActivity;
    activityUsers: BackendRegistration[];
    activityPageItems: BackendActivity[];
    myRegistration?: AppMatchRegistration | null;
    currentTeamId?: number | null;
    currentUserId?: number;
  },
  loaders: Pick<MatchDetailDataLoaders, "getTeamDetail"> = defaultMatchDetailDataLoaders,
): Promise<AuthenticatedMatchDetailContext> {
  const { activity, activityUsers, activityPageItems, myRegistration, currentTeamId, currentUserId } = params;
  const teamIds = [activity.home_team_id, activity.away_team_id].filter((teamId): teamId is number => typeof teamId === "number");
  const fetchedTeamDetails = await Promise.all(teamIds.map(async (teamId) => loaders.getTeamDetail(teamId)));
  const fetchedTeams = fetchedTeamDetails.map((detail) => detail.team);
  // 报名板跟随比赛所属球队：优先当前选中球队；用户切换到其他球队后，回退到
  // 「当前用户是活跃成员」的那支比赛队伍（主队在前），两边都不属于时才留空隐藏。
  const rosterDetail =
    fetchedTeamDetails.find((detail) => detail.team.id === currentTeamId)
    ?? fetchedTeamDetails.find((detail) => detail.members.some((member) => member.user_id === currentUserId && member.status === 1));
  const currentTeamMembers = rosterDetail?.members ?? [];
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
      ? toRegistrationStandCode(myRegistration.status)
      : activityUsers.find((item) => item.user_id === currentUserId)?.stand ?? 0,
    currentTeamMembers,
    checkInConfig: activity.source_activity_id
      ? null
      : activity.team_checkin_configs.find((item) => item.team_id === currentTeamId) ?? null,
  };
}
