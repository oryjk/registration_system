import type {
  BackendActivity,
  BackendChallengeSummary,
  BackendRegistration,
  BackendUser,
  BackendUserActivityRecord,
} from "@/types/backend";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { formatDateLabel, formatWeekdayLabel } from "@/utils/datetime";
import { attendanceStatusTone } from "@/utils/statusTone";
import {
  avatarTone,
  pickFirstNonEmpty,
  toActivityStatusLabel,
  toHomeMatchPhaseFromStatus,
  toStandLabel,
  type VisibleHomeMatchPhase,
} from "./common";

interface HomeMatchCardParams {
  activities: BackendActivity[];
  myActivityRecords?: BackendUserActivityRecord[];
  registrationsByActivityId: Record<string, BackendRegistration[]>;
  teamRegistrationCountsByActivityId?: Record<string, number>;
  usersById?: Record<number, BackendUser>;
  defaultStatusLabel?: string;
  limit?: number;
  teamId?: number;
}

function toDateBlock(dateLabel: string, dateSource: string): HomeMatchCardViewModel["dateBlock"] {
  const [monthDay = "", timeLabel = ""] = dateLabel.split(" ");
  return {
    monthDay,
    weekday: formatWeekdayLabel(dateSource),
    timeLabel,
  };
}

function toStageTone(phase: VisibleHomeMatchPhase): HomeMatchCardViewModel["stageTone"] {
  if (phase === "ongoing") return "blue";
  if (phase === "ended") return "muted";
  return "lime";
}

function toStatusTone(status: string): HomeMatchCardViewModel["statusTone"] {
  switch (attendanceStatusTone(status)) {
    case "join":
      return "green";
    case "leave":
      return "muted";
    case "late":
      return "amber";
    default:
      return "blue";
  }
}

function buildActivityHomeMatchCards(params: HomeMatchCardParams): HomeMatchCardViewModel[] {
  const myRecordByActivityId = Object.fromEntries(
    (params.myActivityRecords ?? []).map((item) => [item.activity_id, item]),
  );
  const activities = params.teamId == null
    ? params.activities
    : params.activities.filter(
        (activity) => activity.home_team_id === params.teamId || activity.away_team_id === params.teamId,
      );

  return activities
    .sort((left, right) => left.holding_date.localeCompare(right.holding_date))
    .slice(0, params.limit ?? activities.length)
    .map((activity) => {
      const registrations = params.registrationsByActivityId[activity.id] ?? [];
      const individualJoinedPlayers = registrations.filter((item) => item.stand === 1).length;
      const teamJoinedPlayers = activity.source_activity_id
        ? 0
        : (params.teamRegistrationCountsByActivityId?.[activity.id] ?? 0);
      const joinedPlayers = individualJoinedPlayers + teamJoinedPlayers;
      const absentPlayers = registrations.filter((item) => item.stand === 2).length;
      const latePlayers = registrations.filter((item) => item.stand === 3).length;
      const pendingPlayers = registrations.filter(
        (item) => item.stand !== 1 && item.stand !== 2 && item.stand !== 3,
      ).length;
      const requiredPlayers = activity.players_per_team ?? 0;
      const signupScope = activity.source_activity_id ? "internal" : "external";
      const myRecord = myRecordByActivityId[activity.id];
      const myStatus = myRecord ? toStandLabel(myRecord.stand) : (params.defaultStatusLabel ?? "待定");
      const remainingPlayers = Math.max(requiredPlayers - joinedPlayers, 0);
      const phase = toHomeMatchPhaseFromStatus(activity.status);
      const dateLabel = formatDateLabel(activity.holding_date);
      const dateSource = activity.start_time || activity.holding_date;
      const participantAvatars = registrations
        .filter((item) => item.stand === 1)
        .slice(0, 5)
        .map((item) => {
          const user = params.usersById?.[item.user_id];
          const displayName = pickFirstNonEmpty([user?.real_name, user?.nickname, user?.username]) || `U${item.user_id}`;
          return {
            userId: item.user_id,
            avatarUrl: user?.avatar_url ?? "",
            displayText: displayName.slice(0, 1),
            tone: avatarTone(item.user_id),
          };
        });

      return {
        id: activity.id,
        detailUrl: `/pages/matches/detail?id=${activity.id}`,
        title: activity.name,
        dateLabel,
        dateSource,
        dateBlock: toDateBlock(dateLabel, dateSource),
        phase,
        dateNote: phase === "ended" ? "比赛已结束" : phase === "ongoing" ? "报名已结束" : "截止报名",
        showRegistrationProgress: phase !== "ended",
        showParticipantAvatars: phase !== "ended",
        canOpenDetail: true,
        stage: toActivityStatusLabel(activity.status),
        stageTone: toStageTone(phase),
        statusTone: toStatusTone(myStatus),
        publicationModeLabel: activity.match_kind === "internal" ? "队内内战" : "线下已约",
        signupScope,
        signupScopeLabel: signupScope === "internal" ? "队内报名" : "比赛报名",
        venue: activity.location,
        opponent: activity.opposing?.trim() || "待定",
        formatLabel: requiredPlayers > 0 ? `${requiredPlayers} 人制` : "人数待定",
        requiredPlayers,
        maxPlayers: params.teamId == null
          ? requiredPlayers
          : Math.max(activity.team_capacity_limit ?? requiredPlayers, requiredPlayers),
        joinedPlayers,
        absentPlayers,
        latePlayers,
        pendingPlayers,
        myStatus,
        highlight: requiredPlayers > 0
          ? remainingPlayers > 0
            ? `当前 ${joinedPlayers} 人参加，还差 ${remainingPlayers} 人成行`
            : "已达成行人数，仍可继续报名"
          : `当前 ${joinedPlayers} 人参加`,
        participantAvatars,
        remainingPlayersLabel: remainingPlayers > 0 ? `还差 ${remainingPlayers} 人成行` : "已达成行",
        canRegister: true,
      };
    });
}

export function buildHomeMatchCards(params: HomeMatchCardParams & { teamId: number }): HomeMatchCardViewModel[] {
  return buildActivityHomeMatchCards(params);
}

export function buildPublicHomeMatchCards(params: HomeMatchCardParams): HomeMatchCardViewModel[] {
  return buildActivityHomeMatchCards({ ...params, defaultStatusLabel: params.defaultStatusLabel ?? "待登录" });
}

function challengeSignupCapacity(summary: BackendChallengeSummary): number {
  return summary.challenge.kind === "individual"
    ? summary.challenge.max_players ?? summary.challenge.players_per_team * 2 + 4
    : summary.challenge.players_per_team;
}

function challengeMinSignupPlayers(summary: BackendChallengeSummary): number {
  return summary.challenge.kind === "individual"
    ? summary.challenge.min_players ?? summary.challenge.players_per_team * 2
    : summary.challenge.players_per_team;
}

function toIndividualChallengeStageLabel(status: string): string {
  if (status === "matched") return "已成行";
  if (status === "cancelled") return "已取消";
  return "报名中";
}

export function buildJoinedIndividualHomeMatchCards({
  summaries,
  limit,
}: {
  summaries: BackendChallengeSummary[];
  limit?: number;
}): HomeMatchCardViewModel[] {
  return summaries
    .filter(
      (summary) => summary.challenge.kind === "individual" && summary.current_user_joined && summary.challenge.status !== "cancelled",
    )
    .sort((left, right) => left.challenge.holding_date.localeCompare(right.challenge.holding_date))
    .slice(0, limit ?? summaries.length)
    .map((summary) => {
      const minPlayers = challengeMinSignupPlayers(summary);
      const capacity = challengeSignupCapacity(summary);
      const joinedPlayers = summary.accepted_count;
      const remainingPlayers = Math.max(minPlayers - joinedPlayers, 0);
      const phase: VisibleHomeMatchPhase = summary.challenge.status === "matched" ? "ongoing" : "upcoming";
      const dateLabel = formatDateLabel(summary.challenge.holding_date);
      const dateSource = summary.challenge.start_time || summary.challenge.holding_date;
      return {
        id: summary.challenge.id,
        detailUrl: `/pages/challenges/detail?id=${summary.challenge.id}`,
        title: summary.challenge.title,
        dateLabel,
        dateSource,
        dateBlock: toDateBlock(dateLabel, dateSource),
        phase,
        dateNote: phase === "ongoing" ? "比赛进行中" : "截止报名",
        showRegistrationProgress: true,
        showParticipantAvatars: false,
        canOpenDetail: true,
        stage: toIndividualChallengeStageLabel(summary.challenge.status),
        stageTone: toStageTone(phase),
        statusTone: "green",
        publicationModeLabel: "散人对手",
        signupScope: "external",
        signupScopeLabel: "散人报名",
        venue: summary.challenge.location,
        opponent: "散人局",
        formatLabel: `${summary.challenge.players_per_team} 人制`,
        requiredPlayers: minPlayers,
        maxPlayers: capacity,
        joinedPlayers,
        absentPlayers: 0,
        latePlayers: 0,
        pendingPlayers: 0,
        myStatus: "已报名",
        highlight: remainingPlayers > 0 ? `当前 ${joinedPlayers} 人报名，还差 ${remainingPlayers} 人成行` : "已成行",
        participantAvatars: [],
        remainingPlayersLabel: remainingPlayers > 0 ? `还差 ${remainingPlayers} 人` : "已成行",
        canRegister: true,
        actionLabel: "去查看",
      };
    });
}
